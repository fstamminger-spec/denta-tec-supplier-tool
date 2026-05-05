# Deployment Script for New Supplier Product Feed Processor (Monolithic)
# Project: nice-beanbag-435211-a3
# Region: us-west1
# Service: new-supplier-product-feed-processor

$PROJECT_ID = "nice-beanbag-435211-a3"
$REGION = "us-west1"
$SERVICE_NAME = "new-supplier-product-feed-processor"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Check if logged in to gcloud
Write-Host "Checking gcloud authentication..." -ForegroundColor Cyan
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)"
if (-not $authCheck) {
    Write-Host "Error: Not authenticated with gcloud. Please run 'gcloud auth login' first." -ForegroundColor Red
    exit
}

Write-Host "Building Monolithic Docker image..." -ForegroundColor Cyan
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed." -ForegroundColor Red
    exit
}

Write-Host "Pushing image to GCR..." -ForegroundColor Cyan
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker push failed." -ForegroundColor Red
    exit
}

Write-Host "Deploying to Cloud Run..." -ForegroundColor Cyan
# Env vars are read from environment or must be set before running this script:
#   $env:API_KEY            - Google Gemini API key
#   $env:VIRTUAL_MARKETER_API_KEY - Virtual Marketer API key
#   $env:XENTRAL_FEED_URL   - Xentral NDJSON feed permalink
if (-not $env:API_KEY -or -not $env:VIRTUAL_MARKETER_API_KEY -or -not $env:XENTRAL_FEED_URL) {
    Write-Host "Error: Required env vars not set. Set API_KEY, VIRTUAL_MARKETER_API_KEY, and XENTRAL_FEED_URL before deploying." -ForegroundColor Red
    exit
}
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --project $PROJECT_ID `
    --allow-unauthenticated `
    --set-env-vars "API_KEY=$env:API_KEY,VIRTUAL_MARKETER_API_KEY=$env:VIRTUAL_MARKETER_API_KEY,XENTRAL_FEED_URL=$env:XENTRAL_FEED_URL"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Deployment failed." -ForegroundColor Red
    exit
}

Write-Host "Deployment successful!" -ForegroundColor Green
Write-Host "Service URL: $(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)')" -ForegroundColor Yellow
