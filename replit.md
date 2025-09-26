# Meta Ad Creative Generator

## Overview
The Meta Ad Creative Generator is a full-stack web application designed for creating AI-powered video advertisements for Meta (Facebook) campaigns. Its primary purpose is to generate AI scripts, professional voice recordings, and complete video assets for Meta advertising, with direct integration to Google Sheets for data export. The application focuses exclusively on video ad creation and script generation, having removed all file upload functionalities. It aims to leverage AI to analyze campaign performance data and produce optimized, high-quality ad creatives.

## User Preferences
Preferred communication style: Simple, everyday language.
Message formatting: Use completely plain text in all Slack messages - NO asterisks, underscores, backticks, or any markdown formatting.
AI Script Generation: Uses GPT-4o model with highest reasoning capabilities for superior creative script writing. Focus only on voiceover scripts, not visual scenes. Scripts must analyze BOTH successful AND failed performance patterns from actual data. Learn from what works AND what doesn't work to create better scripts. Never create scripts from scratch - always base them on patterns found in both high and low performing data. Background visuals are constant - only the spoken narration changes. Always write "what three words" instead of "what3words" for proper voice pronunciation. Scripts must be exactly 55-65 words (maximum 17-18 seconds of audio) to fit well within the 20-second background video duration with appropriate silent gaps. Scripts follow three-part structure: attention-grabbing opening, clear product explanation, and call-to-action that connects back to the opening. Uses confident, universally appealing language with creative elements for Meta platforms. Language tone is natural conversational - how normal people talk to each other, not overly formal or friendly.
Voice Generation: Optional professional voice recordings using ElevenLabs API with toggle control in the unified workflow. Users can generate scripts with or without audio recordings. Default voice: 'Ella AI' (huvDR9lwwSKC0zEjZUox) for consistent professional narration when audio is enabled.
Video Generation: Automatic video overlay using fluent-ffmpeg when background videos are available. AI voiceovers are automatically merged with background videos to create complete, Meta-ready video assets. Background videos can be uploaded locally or imported directly from Google Drive (requires Google Drive API to be enabled in Google Cloud Console for the service account project).

## System Architecture

### UI/UX Decisions
The application uses React 18 with TypeScript for the frontend, built with Vite for performance. UI components are crafted with shadcn/ui on Radix UI primitives, styled using Tailwind CSS. Wouter handles client-side routing, and React Hook Form with Zod manages form validation. The interface is single-page, centered on the Video Creator functionality.

### Technical Implementations
- **AI Script Generation**: Utilizes OpenAI's GPT-4o model for generating creative scripts based on analysis of Meta campaign performance data (both high and low performing). Scripts adhere to a specific word count (55-65 words) and a three-part structure (opening, product explanation, call-to-action).
- **Voice Synthesis**: Integrates ElevenLabs API for professional voice recordings, with 'Ella AI' as the default voice.
- **Video Production**: Employs FFmpeg for combining AI-generated voiceovers with background videos to create final ad assets.
- **Data Export**: Exports scripts and metadata to Google Sheets, creating timestamped tabs for each generation session.
- **Authentication**: Session-based authentication using Meta OAuth with automatic token refresh.
- **Slack Integration**: Comprehensive workflow for sending video batch approval messages to Slack channels with automatic reaction voting (✅/❌). Includes a 15-minute delay for Google Drive processing before notifications are sent.
- **Automatic Video Deletion**: Automatically deletes rejected videos from Google Drive based on Slack approval workflow outcomes.

### Feature Specifications
- **Campaign Management**: Real-time synchronization with Meta API, supporting App Install and Standard campaign types, with search and filtering.
- **Reporting System**: Exports performance data to Google Sheets, configurable by date ranges and metrics.
- **Google Drive Integration**: Manages background videos, imports from Google Drive, and organizes generated video batches into timestamped folders.

### System Design Choices
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Query, Wouter, React Hook Form, Zod.
- **Backend**: Node.js, TypeScript, Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM for schema management.
- **Deployment**: Replit autoscale, with separate build processes for frontend (Vite) and backend (esbuild).

## External Dependencies

### Meta Marketing API
- **Purpose**: Campaign management and creative operations.
- **Authentication**: OAuth 2.0.
- **Required Permissions**: `ads_management`, `ads_read`, `business_management`.

### Google Sheets API
- **Purpose**: Performance report generation and script export.
- **Authentication**: Service account with JSON credentials.

### Google Drive API
- **Purpose**: Importing background videos, storing generated video assets, and managing approval workflows.

### Neon Database
- **Purpose**: Primary data storage (PostgreSQL).

### ElevenLabs API
- **Purpose**: Professional voice synthesis for AI-generated scripts.

### Slack API (`@slack/web-api`)
- **Purpose**: Integrating approval workflows and notifications.

### OpenAI API
- **Purpose**: AI script generation using the GPT-4o model.