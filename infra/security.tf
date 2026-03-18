# ─── Security Groups ───────────────────────────────────────

# ECS: Allow inbound on API port from anywhere (no ALB)
resource "aws_security_group" "ecs" {
  name_prefix = "${var.app_name}-ecs-"
  description = "Security group for ECS Fargate tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "API port from internet"
    from_port   = var.api_port
    to_port     = var.api_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound (Anthropic API, RDS, etc.)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-ecs-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS: Allow inbound from ECS only
resource "aws_security_group" "rds" {
  name_prefix = "${var.app_name}-rds-"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-rds-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}
