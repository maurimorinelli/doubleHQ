# ─── Outputs ───────────────────────────────────────────────

output "api_info" {
  description = "How to find the API URL"
  value       = "API runs on ECS with public IP. Find it: aws ecs list-tasks --cluster ${aws_ecs_cluster.main.name} | then describe the ENI"
}

output "frontend_url" {
  description = "Frontend URL (S3 website)"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for Docker push"
  value       = aws_ecr_repository.api.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name (for deploy commands)"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name (for deploy commands)"
  value       = aws_ecs_service.api.name
}

output "s3_bucket_name" {
  description = "S3 bucket name for frontend deployment"
  value       = aws_s3_bucket.frontend.bucket
}
