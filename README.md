# DentaTec Supplier Tool

Supplier product feed processor and buyer ordering portal for DentaTec Dental-Handel GmbH.

## Architecture

- **Frontend**: React/TypeScript (Vite) — supplier feed analysis, product management, mass ordering
- **Backend**: Node.js/Express — API proxy, Xentral catalog integration, authentication, Gemini AI
- **Deployment**: Docker (monolithic) on Google Cloud Run

## Prerequisites

- Node.js 20+
- Docker (for deployment)
- Google Cloud SDK (`gcloud`)

## Local Development

1. Install dependencies:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. Set environment variables in `backend/.env.local`:
   ```
   API_KEY=<your-gemini-api-key>
   VIRTUAL_MARKETER_API_KEY=<your-vm-api-key>
   XENTRAL_FEED_URL=<xentral-ndjson-feed-url>
   ```

3. Start the backend dev server:
   ```bash
   cd backend && npm run dev
   ```

4. Start the frontend dev server:
   ```bash
   cd frontend && npm run dev
   ```

## Deployment

Set the required environment variables before running the deploy script:

```powershell
$env:API_KEY = "<your-gemini-api-key>"
$env:VIRTUAL_MARKETER_API_KEY = "<your-vm-api-key>"
$env:XENTRAL_FEED_URL = "<xentral-ndjson-feed-url>"
.\deploy.ps1
```

**Cloud Run project:** `nice-beanbag-435211-a3`
**Region:** `us-west1`
**Service:** `new-supplier-product-feed-processor`

## License

Copyright Fabian Stamminger, The Platform Group GmbH & Co. KG. All rights reserved.
