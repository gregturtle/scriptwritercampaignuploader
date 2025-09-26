# Meta Ad Creative Generator

## Overview

Meta Ad Creative Generator is a full-stack web application built for creating AI-powered video advertisements for Meta (Facebook) campaigns. The application specializes in generating AI scripts, professional voice recordings, and complete video assets for Meta advertising campaigns, with direct integration to Google Sheets for data export. The upload functionality has been removed - this app focuses solely on video ad creation and script generation.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL
- **File Upload**: Multer for handling multipart/form-data
- **Authentication**: Session-based authentication with Meta OAuth
- **External APIs**: Meta Marketing API integration for campaign management

### Database Architecture
- **Database**: PostgreSQL hosted on Neon
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Key Tables**:
  - `auth_tokens`: Stores Meta API access tokens
  - `files`: File metadata and upload status tracking
  - `campaigns`: Cached campaign data from Meta API
  - `creatives`: Links files to campaigns
  - `activity_logs`: User activity tracking

## Key Components

### Authentication System
- OAuth integration with Meta's Marketing API
- Automatic token refresh handling
- Environment variable fallback for development (`META_ACCESS_TOKEN`)
- Session management with secure token storage

### Video Generation System
- AI script generation from Meta campaign performance data
- Professional voice synthesis using ElevenLabs API
- Automatic video creation with background videos using FFmpeg
- Google Sheets integration for script export and organization
- Background video management with local storage and Google Drive import

### Campaign Management
- Real-time campaign synchronization with Meta API
- Support for both App Install and Standard campaign types
- Campaign search and filtering capabilities
- Bulk creative launching to multiple campaigns

### Reporting System
- Performance data export to Google Sheets
- Configurable date ranges and metrics selection
- Support for custom spreadsheet creation or appending to existing sheets
- Integration with Google Sheets API via service account authentication

## Data Flow

1. **Authentication**: User authenticates via Meta OAuth, tokens stored securely
2. **Campaign Analysis**: Performance data retrieved from Meta API for analysis
3. **Script Generation**: AI analyzes campaign data to generate optimized scripts
4. **Voice Synthesis**: Scripts converted to professional voice recordings via ElevenLabs
5. **Video Creation**: Audio combined with background videos to create complete ad assets
6. **Sheet Export**: Scripts and metadata exported to Google Sheets for tracking

## External Dependencies

### Meta Marketing API
- **Purpose**: Campaign management and creative uploads
- **Authentication**: OAuth 2.0 with access tokens
- **Required Permissions**: ads_management, ads_read, business_management
- **Environment Variables**: 
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `META_REDIRECT_URI`
  - `META_AD_ACCOUNT_ID`

### Google Sheets API
- **Purpose**: Performance report generation
- **Authentication**: Service account with JSON credentials
- **Environment Variables**: `GOOGLE_SERVICE_ACCOUNT_JSON`

### Neon Database
- **Purpose**: Primary data storage
- **Environment Variables**: `DATABASE_URL`

## Deployment Strategy

### Development
- Local development with `npm run dev`
- Vite dev server with HMR for frontend
- tsx for TypeScript execution in development
- Database migrations with `npm run db:push`

### Production
- Build process: `npm run build`
  - Frontend: Vite build to `dist/public`
  - Backend: esbuild bundle to `dist/index.js`
- Start command: `npm run start`
- Deployment target: Replit autoscale
- Port configuration: Internal 5000, External 80

### Environment Configuration
- Development: Auto-authentication with `META_ACCESS_TOKEN`
- Production: Full OAuth flow with Meta
- Database: Neon PostgreSQL with connection pooling
- File storage: Local uploads directory

## Changelog

Changelog:
- June 25, 2025. Initial setup
- June 27, 2025. Added ElevenLabs integration for AI voice generation - scripts now automatically converted to professional voice recordings
- July 02, 2025. Added fluent-ffmpeg integration for automatic video overlay - AI voiceovers now automatically merged with background videos to create complete Meta-ready video assets
- July 08, 2025. Fixed AI script generation to create proper 18-20 second scripts (80-90 words) and corrected data handling to prevent overwriting existing spreadsheet data. AI now reads from "Cleansed with BEAP" tab with historical scored data while new exports append to "Raw Data" tab
- July 08, 2025. Implemented Google Drive auto-upload with resumable uploads and Shared Drive support. Fixed script length to 60-70 words (max 18 seconds) to prevent audio extending beyond 20-second video duration
- July 09, 2025. Added "Load AI Videos" button to upload tab for importing AI-generated videos from Google Drive (folder: 1AIe9UvmYnBJiJyD1rMzLZRNqKDw-BWJh). Fixed Google Drive permissions issue - service account email: replit-paid-ads-sheets-writer@wide-river-461409-c5.iam.gserviceaccount.com needs Editor access to individual video files for Meta campaign upload
- August 04, 2025. Reduced AI script target length from 60-70 words to 50-60 words (16-17 seconds maximum) to ensure audio fits properly within 20-second background videos with fade effects. Fixed video duration issue - videos now maintain full 20-second length instead of being trimmed to match audio duration. Increased script length back to 60-70 words (18-19 seconds) to minimize silent gaps in full-length videos. Adjusted to 55-65 words (17-18 seconds) for optimal balance between content and timing. Enhanced OpenAI prompt with structured three-part script format (opening, product explanation, call-to-action), brand guidelines, and comprehensive refinement checklist for higher quality script generation
- August 13, 2025. Added dynamic voice selector with ElevenLabs API integration supporting Ella AI, Mark, and Samara X voices. Updated file naming to use human-readable timestamps (YYYY-MM-DD_HH-MM-SS) instead of Unix timestamps for better tracking and organization of both audio and video assets. Implemented batch-level timestamped folder organization - all videos from one script generation session are uploaded to a single Google Drive subfolder named "Generated_YYYY-MM-DD_HH-MM-SS" for easy batch management when uploading to Meta campaigns. Each generation creates ONE folder containing ALL videos from that batch, making campaign upload selection much easier. Updated "Load AI Videos" functionality to display organized batch folders instead of individual video files, with batch folder selection UI showing video counts and creation dates for easy identification of generation sessions
- August 15, 2025. Added "File Title" column to Google Sheets script export, positioned as the second column after "Generated Date". This column contains the safe filename format that will be used when scripts are converted to audio/video files, matching the naming convention used by the video service. Enhanced GoogleSheetsService with createTab() and appendDataToTab() methods for better sheet management. Began implementing Slack approval workflow integration with @slack/web-api package for sending video batches to team channels with tick/cross reaction voting. Implemented sequential script numbering - all files now begin with 'script1', 'script2', etc. in both Google Sheets file titles and actual audio/video filenames for consistent tracking
- August 15, 2025. **MAJOR ARCHITECTURAL CHANGE**: Removed all upload functionality from the application. The app now focuses exclusively on AI-powered video ad creation and script generation. Removed Home page, FileUploader, UploadList, and useFileUpload components. The Unified page (Video Creator) is now the main entry point. Updated navigation to reflect video creation focus with Video Creator, AI Scripts, and Reports sections. Removed file upload API endpoints. App title changed to "Meta Ad Creative Generator" to better reflect its purpose as a video ad creation tool rather than an upload manager.
- August 15, 2025. **NAVIGATION SIMPLIFICATION**: Removed AI Scripts and Reports tabs from navigation. The app now has a single-page interface focused entirely on the Video Creator functionality. All video generation, script creation, and Google Sheets integration features remain fully intact within the main Video Creator interface.
- August 15, 2025. **TIMESTAMPED GOOGLE SHEETS TABS**: Updated Google Sheets integration to create timestamped tab names for each script generation session. Instead of just "New Scripts", tabs are now named "New Scripts YYYY-MM-DD HH:MM:SS" for better tracking and organization of generation batches. App title updated to "Meta Ad Creative Generator NEW CONCEPTS" with highlighted branding.
- August 15, 2025. **SLACK INTEGRATION**: Implemented comprehensive Slack workflow integration with @slack/web-api package. Added SlackService for sending structured video batch approval messages to team channels with automatic reaction voting (✅/❌). When video batches are generated, they're automatically sent to the configured Slack channel with script details, batch information, and Google Drive folder links. Includes test endpoint and error handling. Requires SLACK_BOT_TOKEN and SLACK_CHANNEL_ID environment variables.
- August 18, 2025. **GOOGLE DRIVE LINK FORMATTING**: Fixed Slack video links to use proper Google Drive format with `?usp=drive_link` parameter (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=drive_link) ensuring clickable links work correctly in Slack channels. Removed problematic server URL approach that wasn't working. Enhanced individual ad approval system where one emoji per ad is sufficient for review completion.
- August 18, 2025. **AUTOMATIC VIDEO DELETION**: Implemented automatic deletion of rejected videos from Google Drive when batch review is complete. System now tracks video file IDs during Slack batch review, identifies videos with ❌ (rejection) reactions, and automatically deletes them from Google Drive when all videos are reviewed. Added deleteFile() and deleteFiles() methods to GoogleDriveService. Batch completion summary messages now include deletion statistics showing how many rejected videos were removed. This ensures only approved videos remain in Google Drive for Meta campaign upload, streamlining the workflow and preventing rejected content from cluttering storage.
- August 18, 2025. **15-MINUTE SLACK DELAY**: Implemented 15-minute delay between video creation and Slack approval workflow posting. This allows Google Drive sufficient time to properly process uploaded videos before team review begins. Videos are uploaded immediately but Slack notifications are scheduled using setTimeout() for 15 minutes later. Users receive notification that "Slack approval workflow will begin in 15 minutes (allowing Google Drive processing time)". This resolves issues with Google Drive processing delays during team video reviews.
- August 18, 2025. **RESTORED 15-MINUTE DELAY**: After testing completion, restored the 15-minute delay process. System now sends immediate batch creation notification followed by 15-minute delay before approval workflow begins. Plain text formatting applied throughout all Slack messages with no asterisks or markdown formatting.

## User Preferences

Preferred communication style: Simple, everyday language.
Message formatting: Use completely plain text in all Slack messages - NO asterisks, underscores, backticks, or any markdown formatting.
AI Script Generation: Focus only on voiceover scripts, not visual scenes. Scripts must analyze BOTH successful AND failed performance patterns from actual data. Learn from what works AND what doesn't work to create better scripts. Never create scripts from scratch - always base them on patterns found in both high and low performing data. Background visuals are constant - only the spoken narration changes. Always write "what three words" instead of "what3words" for proper voice pronunciation. Scripts must be exactly 55-65 words (maximum 17-18 seconds of audio) to fit well within the 20-second background video duration with appropriate silent gaps. Scripts follow three-part structure: attention-grabbing opening, clear product explanation, and call-to-action that connects back to the opening. Uses confident, universally appealing language with creative elements for Meta platforms.
Voice Generation: Optional professional voice recordings using ElevenLabs API with toggle control in the unified workflow. Users can generate scripts with or without audio recordings. Default voice: 'Ella AI' (huvDR9lwwSKC0zEjZUox) for consistent professional narration when audio is enabled.
Video Generation: Automatic video overlay using fluent-ffmpeg when background videos are available. AI voiceovers are automatically merged with background videos to create complete, Meta-ready video assets. Background videos can be uploaded locally or imported directly from Google Drive (requires Google Drive API to be enabled in Google Cloud Console for the service account project).