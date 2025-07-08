# Meta Campaign Manager

## Overview

Meta Campaign Manager is a full-stack web application built for managing Meta (Facebook) advertising campaigns, specifically designed for uploading video creatives and generating performance reports. The application uses a modern React frontend with a Node.js/Express backend, PostgreSQL database via Neon, and integrates with Meta's Marketing API for campaign management and Google Sheets for report generation.

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

### File Management
- Video file upload (.mov format) with progress tracking
- File validation and status management (uploading → ready → completed)
- Integration with Meta's asset library for creative uploads
- Local file storage with unique naming conventions

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
2. **File Upload**: Videos uploaded to local storage, metadata saved to database
3. **Campaign Sync**: Campaigns fetched from Meta API and cached locally
4. **Creative Launch**: Files uploaded to Meta's asset library and linked to campaigns
5. **Report Generation**: Performance data retrieved from Meta API and exported to Google Sheets

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
- July 08, 2025. Google Drive auto-upload disabled due to service account storage quota limitations. Added manual video download system - users can download generated videos and manually upload to Google Drive. System creates perfect 22-25 second audio scripts that fill 20-second video duration.

## User Preferences

Preferred communication style: Simple, everyday language.
AI Script Generation: Focus only on voiceover scripts, not visual scenes. Scripts must analyze BOTH successful AND failed performance patterns from actual data. Learn from what works AND what doesn't work to create better scripts. Never create scripts from scratch - always base them on patterns found in both high and low performing data. Background visuals are constant - only the spoken narration changes. Always write "what three words" instead of "what3words" for proper voice pronunciation. Scripts must fill exactly 18-20 seconds of audio (80-90 words for natural speech pace) to match the full duration of uploaded background videos.
Voice Generation: Optional professional voice recordings using ElevenLabs API with toggle control in the unified workflow. Users can generate scripts with or without audio recordings. Default voice: 'Ella AI' (huvDR9lwwSKC0zEjZUox) for consistent professional narration when audio is enabled.
Video Generation: Automatic video overlay using fluent-ffmpeg when background videos are available. AI voiceovers are automatically merged with background videos to create complete, Meta-ready video assets. Background videos can be uploaded locally or imported directly from Google Drive (requires Google Drive API to be enabled in Google Cloud Console for the service account project).