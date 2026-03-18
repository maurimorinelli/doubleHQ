# ─── Secrets Manager ───────────────────────────────────────

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.app_name}/jwt-secret"
  description             = "JWT signing secret for API authentication"
  recovery_window_in_days = 0 # Immediate deletion for demo

  tags = {
    Name = "${var.app_name}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${var.app_name}/anthropic-api-key"
  description             = "Anthropic API key for Claude AI features"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-anthropic-key"
  }
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  secret_id     = aws_secretsmanager_secret.anthropic_api_key.id
  secret_string = var.anthropic_api_key
}
