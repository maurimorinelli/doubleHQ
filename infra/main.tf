# ─── Terraform Configuration for AI Close Copilot ──────────
# Cost-optimized demo architecture on AWS
# ECS Fargate + RDS PostgreSQL + S3 Static Hosting

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # For demo: local state. In production, use S3 backend:
  # backend "s3" {
  #   bucket = "doublehq-terraform-state"
  #   key    = "state/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "doublehq-copilot"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
