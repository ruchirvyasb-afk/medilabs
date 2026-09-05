# MedLens API — Google Cloud Run Deployment Guide

This guide walks through deploying the MedLens API to **Google Cloud Run** with **Cloud SQL for PostgreSQL**.

---

## Prerequisites

- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A GCP project with billing enabled
- Docker installed locally (for testing builds)

---

## 1. Set up your GCP project

```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
```

## 2. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

## 3. Create Artifact Registry repository

```bash
gcloud artifacts repositories create medlens \
  --repository-format=docker \
  --location=$REGION \
  --description="MedLens API container images"
```

## 4. Create a Cloud SQL PostgreSQL instance

```bash
# Create instance (this takes a few minutes)
gcloud sql instances create medlens-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-auto-increase

# Set a password for the default postgres user
gcloud sql users set-password postgres \
  --instance=medlens-db \
  --password=YOUR_STRONG_DB_PASSWORD

# Create the application database
gcloud sql databases create medlens --instance=medlens-db

# Create an application user
gcloud sql users create medlens_user \
  --instance=medlens-db \
  --password=YOUR_APP_DB_PASSWORD

# Note the connection name (you'll need it later)
gcloud sql instances describe medlens-db --format='value(connectionName)'
# Output: your-project:us-central1:medlens-db
```

## 5. Run database migration

Use **Cloud SQL Auth Proxy** to connect locally and run the migration:

```bash
# Download and run Cloud SQL Auth Proxy
# See: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy

# In a separate terminal:
cloud-sql-proxy $PROJECT_ID:$REGION:medlens-db --port=5432

# In your project directory, set env vars for migration:
export DB_DRIVER=postgres
export DATABASE_URL="postgresql://medlens_user:YOUR_APP_DB_PASSWORD@localhost:5432/medlens"

npm run db:migrate
npm run db:seed
```

## 6. Store secrets in Secret Manager

```bash
# Generate secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Store in Secret Manager
echo -n "postgresql://medlens_user:YOUR_APP_DB_PASSWORD@/medlens?host=/cloudsql/$PROJECT_ID:$REGION:medlens-db" | \
  gcloud secrets create medlens-database-url --data-file=-

echo -n "$JWT_SECRET" | \
  gcloud secrets create medlens-jwt-secret --data-file=-

echo -n "$ENCRYPTION_KEY" | \
  gcloud secrets create medlens-encryption-key --data-file=-
```

## 7. Grant Cloud Run access to secrets

```bash
# Get the Cloud Run service account
SA=$(gcloud iam service-accounts list \
  --filter="displayName:Compute Engine default" \
  --format='value(email)')

# Grant access to each secret
for SECRET in medlens-database-url medlens-jwt-secret medlens-encryption-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 8. Deploy

### Option A: Using Cloud Build (CI/CD)

```bash
export CLOUD_SQL_CONNECTION=$(gcloud sql instances describe medlens-db --format='value(connectionName)')

gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_CLOUD_SQL_CONNECTION=$CLOUD_SQL_CONNECTION
```

### Option B: Direct deploy with gcloud

```bash
# Build and push the image
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/medlens/medlens-api:latest .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/medlens/medlens-api:latest

# Configure Docker for Artifact Registry (first time only)
gcloud auth configure-docker $REGION-docker.pkg.dev

# Deploy to Cloud Run
CLOUD_SQL_CONNECTION=$(gcloud sql instances describe medlens-db --format='value(connectionName)')

gcloud run deploy medlens-api \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/medlens/medlens-api:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --add-cloudsql-instances $CLOUD_SQL_CONNECTION \
  --set-env-vars "NODE_ENV=production,DB_DRIVER=postgres,DB_SSL=false" \
  --set-secrets "DATABASE_URL=medlens-database-url:latest,JWT_SECRET=medlens-jwt-secret:latest,DATA_ENCRYPTION_KEY=medlens-encryption-key:latest"
```

## 9. Verify deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe medlens-api --format='value(status.url)')

# Test health endpoints
curl $SERVICE_URL/api/health
curl $SERVICE_URL/api/health/ready
curl $SERVICE_URL/api/health/info

# Test login
curl -X POST $SERVICE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-seed-password"}'
```

## 10. Custom domain (optional)

```bash
# Map a custom domain
gcloud run domain-mappings create \
  --service medlens-api \
  --domain api.yourdomain.com \
  --region $REGION

# Follow the DNS instructions output by the command
```

---

## Architecture Diagram

```
┌─────────────┐    HTTPS     ┌──────────────┐   Unix Socket   ┌───────────────┐
│   Client    │──────────────│  Cloud Run   │────────────────│  Cloud SQL    │
│  (Browser)  │              │  (Container) │                │  (PostgreSQL) │
└─────────────┘              └──────────────┘                └───────────────┘
                                    │
                              Secret Manager
                             (JWT, Encryption
                              Key, DB URL)
```

## Cost Estimate (Free Tier)

Cloud Run offers a generous free tier:
- **2 million requests/month** free
- **360,000 GB-seconds** of memory free
- **180,000 vCPU-seconds** free

Cloud SQL:
- `db-f1-micro` ≈ **$7–10/month** (this is the main cost)
- Consider using `--activation-policy=ALWAYS` for dev, or upgrade for production

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Connection refused` to Cloud SQL | Verify `--add-cloudsql-instances` flag and socket path in DATABASE_URL |
| `Permission denied` on secrets | Re-run step 7 (IAM bindings) |
| `DATA_ENCRYPTION_KEY must decode to 32 bytes` | Regenerate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| Container keeps restarting | Check logs: `gcloud run services logs read medlens-api` |
| `ECONNREFUSED` on health/ready | DB not connected — check DATABASE_URL and Cloud SQL instance status |
