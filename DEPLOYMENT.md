# Deployment Instructions

## Build Process
The application uses a two-step build process:
1. **Vite** builds the client application → `dist/public/`
2. **esbuild** bundles the server → `dist/index.js`

## File Structure After Build
```
dist/
├── index.js           # Bundled server (runs in production)
└── public/            # Client assets
    ├── index.html
    └── assets/        # JS, CSS bundles
```

## Deployment Commands

### Standard Build & Start
```bash
# Build the application
npm run build

# Start in production mode
NODE_ENV=production node dist/index.js
```

### Alternative Start Script
If the standard start command fails during deployment, use:
```bash
node start-production.js
```
This wrapper script will:
- Verify the build output exists
- Run the build if needed
- Start the production server

## Important Notes

1. **Excluded from Deployment**: The following are excluded to reduce deployment size:
   - `uploads/` directory (22GB+ of user files)
   - `node_modules/` (will be rebuilt)
   - Temporary files and logs

2. **Runtime Directories**: The application will create these on first run:
   - `uploads/backgrounds/`
   - `uploads/videos/`

3. **Environment Variables**: Ensure all required environment variables are set in the deployment environment, especially:
   - `META_ACCESS_TOKEN`
   - `DATABASE_URL`
   - `ELEVENLABS_API_KEY`
   - Google service account credentials

## Troubleshooting

### "dist/index.js not found" Error
Run the build manually:
```bash
npm run build
```

### "Could not find the build directory" Error
The client assets should be at `dist/public/`. Verify with:
```bash
ls -la dist/public/
```

### Large Deployment Size Error
Ensure `.replitignore` and `.dockerignore` files are present and exclude:
- `uploads/**`
- `node_modules/**`
- Large CSV files except `server/data/default_primer.csv`