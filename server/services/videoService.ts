import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

// Configure FFmpeg to use system binaries
ffmpeg.setFfmpegPath('/nix/store/jfybfbnknyiwggcrhi4v9rsx5g4hksvf-ffmpeg-full-6.1.1-bin/bin/ffmpeg');
ffmpeg.setFfprobePath('/nix/store/jfybfbnknyiwggcrhi4v9rsx5g4hksvf-ffmpeg-full-6.1.1-bin/bin/ffprobe');

console.log('FFmpeg configured with system paths');



interface VideoOverlayOptions {
  backgroundVideoPath: string;
  audioPath: string;
  outputPath: string;
  audioDuration?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

interface VideoCreationResult {
  success: boolean;
  outputPath?: string;
  outputUrl?: string;
  duration?: number;
  error?: string;
  driveId?: string;
  driveLink?: string;
}

class VideoService {
  private uploadsDir = path.join(process.cwd(), 'uploads');
  private videosDir = path.join(this.uploadsDir, 'videos');

  constructor() {
    // Ensure videos directory exists
    if (!fs.existsSync(this.videosDir)) {
      fs.mkdirSync(this.videosDir, { recursive: true });
    }
  }

  /**
   * Check if ffmpeg is available and working
   */
  async checkFfmpegAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg()
        .getAvailableFormats((err, formats) => {
          if (err) {
            console.error('FFmpeg check failed:', err);
            resolve(false);
          } else {
            console.log('FFmpeg is available with', Object.keys(formats).length, 'formats');
            resolve(true);
          }
        });
    });
  }

  /**
   * Get video information (duration, dimensions, etc.)
   */
  async getVideoInfo(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  /**
   * Get audio duration in seconds
   */
  async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const duration = metadata.format?.duration || 0;
          resolve(Number(duration));
        }
      });
    });
  }

  /**
   * Overlay audio onto video with optional fade effects
   */
  async overlayAudioOnVideo(options: VideoOverlayOptions): Promise<VideoCreationResult> {
    try {
      const {
        backgroundVideoPath,
        audioPath,
        outputPath,
        fadeInDuration = 0.5,
        fadeOutDuration = 0.5
      } = options;

      // Verify input files exist
      if (!fs.existsSync(backgroundVideoPath)) {
        throw new Error(`Background video not found: ${backgroundVideoPath}`);
      }
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Get video and audio durations
      const videoInfo = await this.getVideoInfo(backgroundVideoPath);
      const audioDuration = await this.getAudioDuration(audioPath);
      const videoDuration = videoInfo.format?.duration || 0;

      console.log(`Video duration: ${videoDuration}s, Audio duration: ${audioDuration}s`);

      // Use the shorter duration to prevent overruns
      const targetDuration = Math.min(videoDuration, audioDuration + 1); // Add 1 second buffer

      return new Promise((resolve, reject) => {
        const command = ffmpeg()
          .input(backgroundVideoPath)
          .input(audioPath)
          .audioFilters([
            `afade=t=in:st=0:d=${fadeInDuration}`,
            `afade=t=out:st=${audioDuration - fadeOutDuration}:d=${fadeOutDuration}`
          ])
          .outputOptions([
            '-c:v copy', // Copy video stream without re-encoding for speed
            '-c:a aac',  // Encode audio as AAC
            '-map 0:v:0', // Map video from first input
            '-map 1:a:0', // Map audio from second input
            '-shortest', // End when shortest stream ends
            '-avoid_negative_ts make_zero',
            '-fflags +genpts'
          ])
          .duration(targetDuration)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg process started:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${Math.round(progress.percent || 0)}% done`);
          })
          .on('end', () => {
            console.log('Video overlay completed successfully');
            
            // Verify output file was created
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              const outputUrl = `/uploads/videos/${path.basename(outputPath)}`;
              
              resolve({
                success: true,
                outputPath,
                outputUrl,
                duration: targetDuration,
              });
            } else {
              reject(new Error('Output file was not created'));
            }
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(err);
          });

        // Start the process
        command.run();
      });

    } catch (error) {
      console.error('Video overlay error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create a video with audio overlay for a script suggestion
   */
  async createVideoForScript(
    scriptTitle: string,
    audioPath: string,
    backgroundVideoPath: string
  ): Promise<VideoCreationResult> {
    try {
      // Generate unique output filename
      const timestamp = Date.now();
      const sanitizedTitle = scriptTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const outputFileName = `video_${sanitizedTitle}_${timestamp}.mp4`;
      const outputPath = path.join(this.videosDir, outputFileName);

      console.log(`Creating video: ${outputFileName}`);

      const result = await this.overlayAudioOnVideo({
        backgroundVideoPath,
        audioPath,
        outputPath,
        fadeInDuration: 0.3,
        fadeOutDuration: 0.5
      });

      // Auto-upload to Google Drive if successful
      if (result.success && result.outputPath) {
        try {
          const { googleDriveService } = await import('./googleDriveService');
          
          // Upload to user's Shared Drive folder
          const driveResult = await googleDriveService.uploadVideoToSpecificFolder(
            result.outputPath,
            outputFileName,
            '0AJv-n4tGtSmhUk9PVA' // User's Shared Drive folder ID
          );
          console.log(`Video uploaded to user's Shared Drive: ${driveResult.webViewLink}`);
          
          // Add Drive link to result
          return {
            ...result,
            driveId: driveResult.id,
            driveLink: driveResult.webViewLink
          };
        } catch (driveError) {
          console.warn('Failed to auto-upload to Google Drive:', driveError);
          // Continue without failing the video creation
        }
      }

      return result;

    } catch (error) {
      console.error('Error creating video for script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create video'
      };
    }
  }

  /**
   * Process multiple scripts and create videos for each
   */
  async createVideosForScripts(
    suggestions: Array<{
      title: string;
      content: string;
      audioFile?: string;
      audioUrl?: string;
    }>,
    backgroundVideoPath: string
  ): Promise<Array<{
    title: string;
    content: string;
    audioFile?: string;
    audioUrl?: string;
    videoFile?: string;
    videoUrl?: string;
    videoError?: string;
  }>> {
    const results = [];

    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      
      if (!suggestion.audioFile || !fs.existsSync(suggestion.audioFile)) {
        console.log(`Skipping video creation for "${suggestion.title}" - no audio file`);
        results.push({
          ...suggestion,
          videoError: 'No audio file available'
        });
        continue;
      }

      console.log(`Creating video ${i + 1}/${suggestions.length}: ${suggestion.title}`);

      const videoResult = await this.createVideoForScript(
        suggestion.title,
        suggestion.audioFile,
        backgroundVideoPath
      );

      if (videoResult.success) {
        results.push({
          ...suggestion,
          videoFile: videoResult.outputPath,
          videoUrl: videoResult.outputUrl
        });
      } else {
        results.push({
          ...suggestion,
          videoError: videoResult.error || 'Failed to create video'
        });
      }
    }

    return results;
  }

  /**
   * Get available background videos
   */
  getAvailableBackgroundVideos(): string[] {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const backgroundsDir = path.join(this.uploadsDir, 'backgrounds');
    
    if (!fs.existsSync(backgroundsDir)) {
      fs.mkdirSync(backgroundsDir, { recursive: true });
      return [];
    }

    return fs.readdirSync(backgroundsDir)
      .filter(file => videoExtensions.some(ext => file.toLowerCase().endsWith(ext)))
      .map(file => path.join(backgroundsDir, file));
  }

  /**
   * Clean up old video files (keep only last 50 videos)
   */
  async cleanupOldVideos(): Promise<void> {
    try {
      const files = fs.readdirSync(this.videosDir)
        .filter(file => file.endsWith('.mp4'))
        .map(file => ({
          name: file,
          path: path.join(this.videosDir, file),
          time: fs.statSync(path.join(this.videosDir, file)).mtime
        }))
        .sort((a, b) => b.time.getTime() - a.time.getTime());

      // Keep only the 50 most recent videos
      const filesToDelete = files.slice(50);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`Cleaned up old video: ${file.name}`);
      }

      if (filesToDelete.length > 0) {
        console.log(`Cleaned up ${filesToDelete.length} old video files`);
      }
    } catch (error) {
      console.error('Error cleaning up old videos:', error);
    }
  }
}

export const videoService = new VideoService();