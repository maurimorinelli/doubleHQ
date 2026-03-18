#!/usr/bin/env bash
# ─── Deploy Script for AI Close Copilot ────────────────────
# Usage: ./scripts/deploy.sh
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Terraform initialized (cd infra && terraform init)
#   - Docker running
#   - Terraform has been applied (terraform apply)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting deployment..."

# ─── 1. Get Terraform outputs ──────────────────────────────
echo "📦 Reading Terraform outputs..."
cd "$PROJECT_ROOT/infra"

ECR_URL=$(terraform output -raw ecr_repository_url)
CLUSTER=$(terraform output -raw ecs_cluster_name)
SERVICE=$(terraform output -raw ecs_service_name)
S3_BUCKET=$(terraform output -raw s3_bucket_name)
FRONTEND_URL=$(terraform output -raw frontend_url)
AWS_REGION="us-east-1"

cd "$PROJECT_ROOT"

# ─── 2. Build and push API Docker image ───────────────────
echo "🐳 Building Docker image (linux/amd64 for Fargate)..."
docker build --platform linux/amd64 -f packages/api/Dockerfile -t "$ECR_URL:latest" .

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_URL"

echo "📤 Pushing image to ECR..."
docker push "$ECR_URL:latest"

# ─── 3. Deploy API (force new ECS deployment) ─────────────
echo "🔄 Deploying new API version..."
aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    > /dev/null

echo "⏳ Waiting for service to stabilize..."
aws ecs wait services-stable \
    --cluster "$CLUSTER" \
    --services "$SERVICE" \
    --region "$AWS_REGION"

# ─── 4. Get API public IP ─────────────────────────────────
echo "🔍 Finding API public IP..."
API_IP=""
for i in 1 2 3 4 5; do
    TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --desired-status RUNNING --region "$AWS_REGION" --query 'taskArns[0]' --output text)
    if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
        echo "   Attempt $i: No running tasks yet, waiting 10s..."
        sleep 10
        continue
    fi
    ENI_ID=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$AWS_REGION" --query 'tasks[0].attachments[*].details[?name==`networkInterfaceId`].value | [0][0]' --output text)
    if [ "$ENI_ID" = "None" ] || [ -z "$ENI_ID" ]; then
        echo "   Attempt $i: ENI not ready, waiting 10s..."
        sleep 10
        continue
    fi
    API_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region "$AWS_REGION" --query 'NetworkInterfaces[0].Association.PublicIp' --output text 2>/dev/null || echo "")
    if [ -n "$API_IP" ] && [ "$API_IP" != "None" ]; then
        break
    fi
    echo "   Attempt $i: Public IP not assigned yet, waiting 10s..."
    sleep 10
done

if [ -z "$API_IP" ] || [ "$API_IP" = "None" ]; then
    echo "⚠️  Could not determine API public IP. Check ECS console."
    echo "   Continuing with frontend build using placeholder..."
    API_IP="UNKNOWN"
fi

# ─── 5. Build and deploy frontend ─────────────────────────
echo "🏗️  Building frontend..."
export VITE_API_URL="http://$API_IP:3001"
npm run build --workspace=packages/web

echo "📤 Uploading frontend to S3..."
aws s3 sync packages/web/dist "s3://$S3_BUCKET" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --region "$AWS_REGION"

# Set index.html with no-cache
aws s3 cp packages/web/dist/index.html "s3://$S3_BUCKET/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html" \
    --region "$AWS_REGION"

# ─── Done ──────────────────────────────────────────────────
echo ""
echo "✅ Deployment complete!"
echo ""
echo "   🌐 Frontend: $FRONTEND_URL"
echo "   🔌 API:      http://$API_IP:3001"
echo "   📊 Health:   http://$API_IP:3001/api/health"
echo ""
