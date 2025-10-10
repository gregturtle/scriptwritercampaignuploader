import React, { useState, useEffect } from 'react';
import Header from "@/components/Header";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Zap, Calendar, ExternalLink, CheckCircle, Mic, Upload, Video, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useMetaAuth } from '@/hooks/useMetaAuth';
import { Link } from 'wouter';
import { LanguageSelector } from '@/components/LanguageSelector';

interface ScriptResult {
  suggestions: Array<{
    title: string;
    content: string;
    nativeContent?: string;  // Native language version when multilingual
    language?: string;       // Language code when multilingual
    reasoning: string;
    targetMetrics?: string[];
    audioUrl?: string;
    audioFile?: string;
    videoUrl?: string;
    videoFile?: string;
    videoError?: string;
    error?: string;
  }>;
  message: string;
  savedToSheet: boolean;
}

export default function Unified() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [withAudio, setWithAudio] = useState(true);
  const [scriptCount, setScriptCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [selectedScripts, setSelectedScripts] = useState<Set<number>>(new Set());
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [backgroundVideos, setBackgroundVideos] = useState<string[]>([]);
  const [showDriveVideos, setShowDriveVideos] = useState(false);
  const [driveVideos, setDriveVideos] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isDriveConfigured, setIsDriveConfigured] = useState(false);
  const [availableBackgroundVideos, setAvailableBackgroundVideos] = useState<{path: string, name: string, url: string}[]>([]);
  const [selectedBackgroundVideo, setSelectedBackgroundVideo] = useState<string>('');
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('I8vyadnJFaMFR0zgn147'); // Default to Hybrid Voice 1
  const [availableVoices, setAvailableVoices] = useState<{voice_id: string, name: string}[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en'); // Default to English
  const [primerFile, setPrimerFile] = useState<File | null>(null);
  const [experimentalPercentage, setExperimentalPercentage] = useState(40);
  const [individualGeneration, setIndividualGeneration] = useState(false);

  const { toast } = useToast();

  // Load available background videos
  useEffect(() => {
    const loadBackgroundVideos = async () => {
      setLoadingVideos(true);
      try {
        const response = await fetch('/api/video/background-videos');
        if (response.ok) {
          const data = await response.json();
          setAvailableBackgroundVideos(data.videos);
          if (data.videos.length > 0 && !selectedBackgroundVideo) {
            setSelectedBackgroundVideo(data.videos[0].path);
          }
        }
      } catch (error) {
        console.error('Error loading background videos:', error);
      } finally {
        setLoadingVideos(false);
      }
    };
    loadBackgroundVideos();
  }, [selectedBackgroundVideo]);

  // Load available voices from ElevenLabs
  useEffect(() => {
    const loadVoices = async () => {
      setLoadingVoices(true);
      try {
        const response = await fetch('/api/elevenlabs/voices');
        if (response.ok) {
          const data = await response.json();
          // Filter for commonly used voices
          const commonVoices = [
            { voice_id: 'I8vyadnJFaMFR0zgn147', name: 'Hybrid Voice 1' },
            { voice_id: 'huvDR9lwwSKC0zEjZUox', name: 'Ellara (Ellabot 2.0)' },
            { voice_id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Mark (Alternative)' }
          ];
          
          // Find Samara X in the returned voices
          const samaraVoice = data.voices.find((voice: any) => 
            voice.name && voice.name.toLowerCase().includes('samara')
          );
          
          if (samaraVoice) {
            commonVoices.push({ 
              voice_id: samaraVoice.voice_id, 
              name: `${samaraVoice.name} (New)` 
            });
          }
          
          setAvailableVoices(commonVoices);
          console.log('Loaded voices:', commonVoices);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
        // Fallback to default voices if API fails
        setAvailableVoices([
          { voice_id: 'I8vyadnJFaMFR0zgn147', name: 'Hybrid Voice 1' },
          { voice_id: 'huvDR9lwwSKC0zEjZUox', name: 'Ellara (Ellabot 2.0)' },
          { voice_id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Mark (Alternative)' }
        ]);
      } finally {
        setLoadingVoices(false);
      }
    };
    
    loadVoices();
  }, []);

  const handleScriptSelection = (index: number, checked: boolean) => {
    setSelectedScripts(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  };

  const handleSelectAllScripts = (checked: boolean) => {
    if (checked) {
      setSelectedScripts(new Set(result?.suggestions.map((_, index) => index) || []));
    } else {
      setSelectedScripts(new Set());
    }
  };

  const handleGenerateAudioForSelected = async () => {
    if (!result || selectedScripts.size === 0) return;

    setIsGeneratingAudio(true);
    try {
      const selectedSuggestions = Array.from(selectedScripts).map(index => 
        result.suggestions[index]
      );

      const response = await fetch('/api/ai/generate-audio-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestions: selectedSuggestions,
          indices: Array.from(selectedScripts)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioResult = await response.json();
      
      // Update the result with new audio URLs
      setResult(prevResult => {
        if (!prevResult) return prevResult;
        
        const updatedSuggestions = [...prevResult.suggestions];
        audioResult.suggestions.forEach((updatedSuggestion: any, resultIndex: number) => {
          const originalIndex = Array.from(selectedScripts)[resultIndex];
          updatedSuggestions[originalIndex] = updatedSuggestion;
        });

        return {
          ...prevResult,
          suggestions: updatedSuggestions
        };
      });

      toast({
        title: "Audio Generated!",
        description: `Generated ${selectedScripts.size} audio recording${selectedScripts.size !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast({
        title: "Audio Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate audio",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  const { isAuthenticated, logout, login } = useMetaAuth();

  // Fetch background videos on component mount
  React.useEffect(() => {
    fetchBackgroundVideos();
  }, []);

  const fetchBackgroundVideos = async () => {
    try {
      const response = await fetch('/api/video/status');
      if (response.ok) {
        const data = await response.json();
        setBackgroundVideos(data.backgroundVideos || []);
        setIsDriveConfigured(data.driveConfigured || false);
      }
    } catch (error) {
      console.error('Failed to fetch background videos:', error);
    }
  };

  const fetchDriveVideos = async () => {
    setIsLoadingDrive(true);
    try {
      const response = await fetch('/api/drive/videos');
      if (response.ok) {
        const data = await response.json();
        setDriveVideos(data.videos || []);
      } else {
        const errorData = await response.json();
        const isApiNotEnabled = errorData.details?.includes('Google Drive API') || errorData.error?.includes('not enabled');
        
        toast({
          title: "Drive Setup Required",
          description: isApiNotEnabled 
            ? "Google Drive API needs to be enabled in your Google Cloud Console. Check the console for the setup link."
            : errorData.message || "Unable to access Google Drive",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Drive Error",
        description: "Failed to load Google Drive videos",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleDriveVideoDownload = async (fileId: string, fileName: string) => {
    setIsUploadingVideo(true);
    try {
      const response = await fetch('/api/drive/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Video Downloaded!",
          description: `"${fileName}" is now available as a background video`,
        });
        await fetchBackgroundVideos();
        setShowDriveVideos(false);
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download video",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('video', file);

    setIsUploadingVideo(true);
    try {
      const response = await fetch('/api/video/upload-background', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload video');
      }

      const result = await response.json();
      
      toast({
        title: "Video Uploaded!",
        description: `Background video "${result.filename}" uploaded successfully`,
      });

      // Refresh the background videos list
      await fetchBackgroundVideos();
      
      // Clear the input
      event.target.value = '';
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload video",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleGenerate = async () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a Google Sheets URL or ID",
        variant: "destructive"
      });
      return;
    }

    if (withAudio && availableBackgroundVideos.length > 0 && !selectedBackgroundVideo) {
      toast({
        title: "Background Video Required",
        description: "Please select a background video for video generation",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setResult(null);
    setSelectedScripts(new Set());
    setIsGeneratingAudio(false);

    try {
      // Generate AI scripts using Guidance Primer
      const scriptRequestBody: any = {
        spreadsheetId: spreadsheetId.trim(),
        generateAudio: withAudio,
        scriptCount: scriptCount,
        backgroundVideoPath: selectedBackgroundVideo,
        voiceId: selectedVoice,
        language: selectedLanguage,
        experimentalPercentage: experimentalPercentage,
        individualGeneration: individualGeneration
      };

      // Add guidance prompt only if provided
      if (guidance.trim().length > 0) {
        scriptRequestBody.guidancePrompt = guidance.trim();
      }

      // Add primer file content if uploaded
      if (primerFile) {
        const primerContent = await primerFile.text();
        scriptRequestBody.primerContent = primerContent;
      }

      const scriptResponse = await fetch('/api/ai/generate-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scriptRequestBody)
      });

      if (!scriptResponse.ok) {
        throw new Error('Failed to generate AI scripts');
      }

      const scriptResult = await scriptResponse.json();

      setResult(scriptResult);

      // Clear guidance after successful generation
      const wasGuidanceUsed = guidance.trim().length > 0;
      setGuidance('');

      toast({
        title: "Complete Success!",
        description: `Generated ${scriptResult.suggestions.length} AI script suggestions${wasGuidanceUsed ? ' with creative guidance applied' : ''}`,
      });

    } catch (error) {
      console.error('Error in unified generation:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        onLogin={login}
      />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Script, Audio and Video Generation
          </h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Generate AI script suggestions using proven patterns from the Guidance Primer and control creative experimentation.
        </p>

      </div>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure your script generation settings and Google Sheets destination
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Sheets URL - moved to top as most important */}
          <div className="space-y-2">
            <Label htmlFor="spreadsheet">Google Sheets URL or ID</Label>
            <Input
              id="spreadsheet"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit or just the sheet ID"
            />
          </div>

          {/* Script Count Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <Label htmlFor="script-count" className="text-sm font-medium">
                Number of scripts:
              </Label>
              <Select value={scriptCount.toString()} onValueChange={(value) => setScriptCount(parseInt(value))}>
                <SelectTrigger className="w-20" id="script-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <Label htmlFor="language-selector" className="text-sm font-medium">
              Script Language
            </Label>
            <LanguageSelector
              value={selectedLanguage}
              onValueChange={setSelectedLanguage}
            />
            <p className="text-xs text-gray-500">
              Scripts will be written natively in the selected language, then translated to English.
            </p>
          </div>

          {/* AI Guidance - Optional creative direction */}
          <div className="space-y-2">
            <Label htmlFor="ai-guidance" className="text-sm font-medium">
              AI Creative Inspiration (Optional)
            </Label>
            <Textarea
              id="ai-guidance"
              data-testid="input-ai-guidance"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g., outdoor pursuits, meetup spots, family activities..."
              className="min-h-16 resize-none"
              maxLength={1000}
            />
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Provide thematic direction to guide script generation. This will be cleared after each batch.</span>
              <span>{guidance.length}/1000</span>
            </div>
          </div>

          {/* Update Guidance Primer */}
          <div className="space-y-2">
            <Label htmlFor="primer-upload" className="text-sm font-medium">
              Update Guidance Primer (Optional)
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="primer-upload"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPrimerFile(file);
                    toast({
                      title: "Primer Uploaded",
                      description: `Using custom primer: ${file.name}`,
                    });
                  }
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('primer-upload')?.click()}
                data-testid="button-upload-primer"
              >
                <Upload className="mr-2 h-3 w-3" />
                {primerFile ? 'Change Primer' : 'Upload Primer'}
              </Button>
              {primerFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{primerFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPrimerFile(null);
                      toast({
                        title: "Primer Removed",
                        description: "Using default primer",
                      });
                    }}
                    data-testid="button-remove-primer"
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {primerFile 
                ? `Using custom primer file: ${primerFile.name}` 
                : 'Using default primer with proven script patterns'
              }
            </p>
          </div>

          {/* Experimentation Percentage */}
          <div className="space-y-2">
            <Label htmlFor="experimental-percentage" className="text-sm font-medium">
              Experimentation Level
            </Label>
            <div className="flex items-center gap-4">
              <Select 
                value={experimentalPercentage.toString()} 
                onValueChange={(value) => setExperimentalPercentage(parseInt(value))}
              >
                <SelectTrigger className="w-32" id="experimental-percentage" data-testid="select-experimental-percentage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="40">40%</SelectItem>
                  <SelectItem value="60">60%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">experimental scripts</span>
            </div>
            <p className="text-xs text-gray-500">
              {experimentalPercentage}% of scripts will be creative curveballs that deviate from the primer guidance. {100 - experimentalPercentage}% will follow the primer closely.
            </p>
          </div>

          {/* Background Video Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <Label htmlFor="video-upload" className="text-sm font-medium">
                Background Videos ({backgroundVideos.length}):
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="video-upload"
                  type="file"
                  accept=".mp4,.mov,.avi,.mkv"
                  onChange={handleVideoUpload}
                  disabled={isUploadingVideo}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => document.getElementById('video-upload')?.click()}
                  disabled={isUploadingVideo}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  {isUploadingVideo ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      UPLOADING...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-3 w-3" />
                      UPLOAD VIDEO
                    </>
                  )}
                </Button>
                {isDriveConfigured && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDriveVideos(!showDriveVideos);
                      if (!showDriveVideos) {
                        fetchDriveVideos();
                      }
                    }}
                    disabled={isLoadingDrive}
                  >
                    {isLoadingDrive ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Calendar className="mr-2 h-3 w-3" />
                        Google Drive
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-gray-500">
              {backgroundVideos.length > 0 
                ? `Available: ${backgroundVideos.join(', ')}. Videos will be automatically created when audio is generated.`
                : "Upload background videos (.mp4, .mov, .avi, .mkv) to automatically create complete video assets."
              }
              {isDriveConfigured && " You can also import videos from Google Drive (requires Drive API to be enabled)."}
            </p>

            {/* Google Drive Video Browser */}
            {showDriveVideos && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium mb-3">Google Drive Videos</h4>
                {isLoadingDrive ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Loading videos from Google Drive...</p>
                  </div>
                ) : driveVideos.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">No videos found in Google Drive</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {driveVideos.map((video) => (
                      <div key={video.id} className="flex items-center justify-between p-3 bg-white rounded border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{video.name}</p>
                          <p className="text-xs text-gray-500">
                            {video.formattedSize} • {video.mimeType?.split('/')[1]?.toUpperCase()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDriveVideoDownload(video.id, video.name)}
                          disabled={isUploadingVideo}
                          className="ml-2"
                        >
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Background Video Selector */}
          <div className="space-y-3 border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-600" />
              Background Video Selection
            </Label>
            <p className="text-sm text-gray-600">Choose which video to use as background for AI-generated content</p>
            
            {loadingVideos ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 p-3 border rounded-md bg-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading videos...
              </div>
            ) : availableBackgroundVideos.length > 0 ? (
              <div className="bg-white p-3 rounded-md border space-y-3">
                <div className="text-sm font-medium">Available Videos: {availableBackgroundVideos.length}</div>
                <Select value={selectedBackgroundVideo} onValueChange={setSelectedBackgroundVideo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a background video">
                      {selectedBackgroundVideo ? availableBackgroundVideos.find(v => v.path === selectedBackgroundVideo)?.name : 'Choose a background video'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableBackgroundVideos.map((video) => (
                      <SelectItem key={video.path} value={video.path}>
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-purple-600" />
                          <span className="truncate">{video.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Native dropdown fallback */}
                <select 
                  value={selectedBackgroundVideo} 
                  onChange={(e) => setSelectedBackgroundVideo(e.target.value)}
                  className="w-full p-2 border rounded-md bg-white text-sm"
                >
                  <option value="">Select video...</option>
                  {availableBackgroundVideos.map((video) => (
                    <option key={video.path} value={video.path}>
                      {video.name}
                    </option>
                  ))}
                </select>
                {selectedBackgroundVideo && (
                  <div className="border rounded-md p-2 bg-gray-50">
                    <div className="text-xs font-medium mb-1">Preview:</div>
                    <video 
                      src={availableBackgroundVideos.find(v => v.path === selectedBackgroundVideo)?.url} 
                      className="w-full max-w-sm rounded border"
                      controls
                      muted
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-amber-700 bg-amber-100 p-3 rounded-md border border-amber-300">
                <div className="flex items-center gap-2 mb-1">
                  <Video className="h-4 w-4" />
                  <strong>No background videos found</strong>
                </div>
                <p>Upload videos above to generate video content with your scripts.</p>
              </div>
            )}
          </div>

          {/* Voice Selection */}
          {withAudio && (
            <div className="space-y-3 border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Voice Selection
              </Label>
              <p className="text-sm text-gray-600">Choose the ElevenLabs voice for AI-generated audio</p>
              
              <div className="bg-white p-3 rounded-md border space-y-3">
                {loadingVoices ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 p-3 border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading voices from ElevenLabs...
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium">Available Voices: {availableVoices.length}</div>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a voice">
                          {availableVoices.find(v => v.voice_id === selectedVoice)?.name || 'Select voice'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.voice_id} value={voice.voice_id}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-blue-600" />
                              <span>{voice.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Native dropdown fallback */}
                    <select 
                      value={selectedVoice} 
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="w-full p-2 border rounded-md bg-white text-sm"
                    >
                      {availableVoices.map((voice) => (
                        <option key={voice.voice_id} value={voice.voice_id}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                    
                    <div className="text-xs text-gray-500">
                      <strong>Selected:</strong> {availableVoices.find(v => v.voice_id === selectedVoice)?.name || 'Unknown voice'}
                      <br />
                      <strong>Voice ID:</strong> {selectedVoice}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Audio Generation Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <Label htmlFor="audio-toggle" className="text-sm font-medium">
                Scripts only
              </Label>
              <Switch
                id="audio-toggle"
                checked={withAudio}
                onCheckedChange={setWithAudio}
              />
              <Label htmlFor="audio-toggle" className="text-sm font-medium">
                With audio{availableBackgroundVideos.length > 0 ? ' + video' : ''}
              </Label>
            </div>
            <p className="text-center text-sm text-gray-500">
              {withAudio 
                ? `Will generate ${scriptCount} scripts with professional voice recordings${availableBackgroundVideos.length > 0 && selectedBackgroundVideo ? ' and complete video assets' : ''}` 
                : `Will generate ${scriptCount} scripts without audio recordings`
              }
            </p>
          </div>

          {/* Individual Generation Toggle */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-center space-x-3">
              <Label htmlFor="individual-toggle" className="text-sm font-medium">
                Batch generation
              </Label>
              <Switch
                id="individual-toggle"
                checked={individualGeneration}
                onCheckedChange={setIndividualGeneration}
                data-testid="toggle-individual-generation"
              />
              <Label htmlFor="individual-toggle" className="text-sm font-medium">
                Individual calls
              </Label>
            </div>
            <p className="text-center text-sm text-gray-500">
              {individualGeneration 
                ? `${scriptCount} separate API calls for maximum quality & diversity (slower, higher cost)` 
                : `Single API call requesting ${scriptCount} scripts (faster, lower cost)`
              }
            </p>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Scripts...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate {scriptCount} Script{scriptCount !== 1 ? 's' : ''} {withAudio && '+ Audio'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Success Summary */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-800 mb-4">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium text-lg">Generation Complete!</span>
              </div>
              <div className="text-sm">
                <p className="font-medium">AI Scripts:</p>
                <p>{result.suggestions.length} script suggestions generated using Guidance Primer</p>
                <p>Saved to "New Scripts" tab in your Google Sheets</p>
              </div>
            </CardContent>
          </Card>

          {/* Script Suggestions Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Creative Assets</CardTitle>
              <CardDescription>
                AI-generated scripts with optional voiceovers and complete video assets ready for Meta campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bulk Audio Generation Controls (only show if scripts were generated without audio) */}
              {result.suggestions.some(s => !s.audioUrl) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedScripts.size === result.suggestions.length}
                        onCheckedChange={handleSelectAllScripts}
                      />
                      <Label htmlFor="select-all" className="text-sm font-medium">
                        Select all scripts
                      </Label>
                    </div>
                    <Button
                      onClick={handleGenerateAudioForSelected}
                      disabled={selectedScripts.size === 0 || isGeneratingAudio}
                      size="sm"
                      className="ml-4"
                    >
                      {isGeneratingAudio ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Generating Audio...
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-3 w-3" />
                          Generate Audio ({selectedScripts.size})
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Select which scripts to convert to professional voice recordings using Ella AI
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {result.suggestions.map((suggestion, index) => (
                  <Card key={index} className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {/* Checkbox for script selection (only show if no audio) */}
                        {!suggestion.audioUrl && (
                          <Checkbox
                            id={`script-${index}`}
                            checked={selectedScripts.has(index)}
                            onCheckedChange={(checked) => handleScriptSelection(index, checked as boolean)}
                            className="mt-1"
                          />
                        )}
                        
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-900 mb-2">{suggestion.title}</h4>
                          {/* Display native language script if available */}
                          {suggestion.nativeContent ? (
                            <div className="mb-3">
                              <p className="text-sm text-gray-900 mb-1 font-medium italic">"{suggestion.nativeContent}"</p>
                              <p className="text-xs text-gray-600 mb-1">English translation:</p>
                              <p className="text-sm text-gray-700 italic">"{suggestion.content}"</p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 mb-3 italic">"{suggestion.content}"</p>
                          )}
                          <p className="text-xs text-blue-700">{suggestion.reasoning}</p>
                          
                          {/* Video Player (if available) */}
                          {suggestion.videoUrl && (
                            <div className="bg-green-100 border border-green-300 rounded-lg p-3 mt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Upload className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800">Complete Video Asset:</span>
                              </div>
                              <video controls className="w-full max-h-60 rounded">
                                <source src={suggestion.videoUrl} type="video/mp4" />
                                Your browser does not support the video element.
                              </video>
                              <p className="text-xs text-green-700 mt-2">
                                Ready-to-use video with voiceover for Meta campaigns
                              </p>
                            </div>
                          )}

                          {/* Audio Player (if no video available) */}
                          {suggestion.audioUrl && !suggestion.videoUrl && (
                            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Mic className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">AI Voice Recording:</span>
                              </div>
                              <audio controls className="w-full">
                                <source src={suggestion.audioUrl} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          )}

                          {/* Video Error */}
                          {suggestion.videoError && (
                            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mt-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Upload className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-800">Video Creation:</span>
                              </div>
                              <p className="text-xs text-yellow-700">
                                {suggestion.videoError}
                              </p>
                            </div>
                          )}
                          
                          {suggestion.targetMetrics && suggestion.targetMetrics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {suggestion.targetMetrics.map((metric) => (
                                <span key={metric} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {metric}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}