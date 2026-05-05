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
# Setting both Gemini API Key and Virtual Marketer API Key
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --project $PROJECT_ID `
    --allow-unauthenticated `
    --set-env-vars "API_KEY=AIzaSyAmnJF8m4y1tAj8VR9AsJ-PpFhbF6IeQ0o,VIRTUAL_MARKETER_API_KEY=M1e5wYxM-n3y1-gj4c-AZos-APbsnvg9TWxN,XENTRAL_FEED_URL=https://62bc0175971af.xentral.biz/api/v1/analytics/report/126457/permalink/b960e00da6162f8aecb96e7181b8bc4912695805aec7f37b7cec9fed5ce112b512dc8a47e3368f11eec007245eb77e35226b4fa177e4b96ce89e5b7684c7c1472dcbd6e406a057d9f0082cac7f4607b27dfc95d1684398a34218e59c975bef7ee5e4cdc02798594da59649a609402f808fe911fa433c18621fe80a734af438be"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Deployment failed." -ForegroundColor Red
    exit
}

Write-Host "Deployment successful!" -ForegroundColor Green
Write-Host "Service URL: $(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)')" -ForegroundColor Yellow
