# ─── Input Variables ───────────────────────────────────────

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "demo"
}

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "doublehq-copilot"
}

# ─── Database ──────────────────────────────────────────────

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "doublehq_copilot"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "doublehq"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

# ─── Secrets ───────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT signing secret for authentication"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude AI features"
  type        = string
  sensitive   = true
}

variable "seed_secret" {
  description = "Secret for the /api/seed endpoint"
  type        = string
  sensitive   = true
}

# ─── ECS ───────────────────────────────────────────────────

variable "api_cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

variable "api_port" {
  description = "Port the API container listens on"
  type        = number
  default     = 3001
}
