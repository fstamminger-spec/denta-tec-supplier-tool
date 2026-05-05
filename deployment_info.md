# Deployment Information - New Supplier Product Feed Processor

## Cloud Run Services

### 1. Backend Service (API)

- **Service Name:** `new-supplier-product-feed-processor-backend`
- **Project ID:** `nice-beanbag-435211-a3`
- **Region:** `us-west1`
- **Environment Variables:**
  - `API_KEY`: Gemini API Key
  - `VIRTUAL_MARKETER_API_KEY`: Virtual Marketer API Key

### 2. Frontend Service (Web App)

- **Service Name:** `new-supplier-product-feed-processor`
- **Project ID:** `nice-beanbag-435211-a3`
- **Region:** `us-west1`
- **Build Args:**
  - `VITE_BACKEND_URL`: URL of the backend service (injected during build)

## Deployment Script

The `deploy.ps1` script in the root directory automates the deployment of both services in the correct order.

- **Console Link:** [Cloud Run Console](https://console.cloud.google.com/run?project=nice-beanbag-435211-a3)
