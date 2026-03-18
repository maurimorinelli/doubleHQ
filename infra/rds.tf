# ─── RDS PostgreSQL ────────────────────────────────────────
# Cost-optimized: db.t4g.micro, single-AZ, 20 GB

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${var.app_name}-db"

  # Engine
  engine         = "postgres"
  engine_version = "16.4"

  # Instance (cost-optimized for demo)
  instance_class = "db.t4g.micro"

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Networking
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = true   # Temporarily enabled for seeding — revert to false after

  # Availability (single-AZ for cost savings)
  multi_az = false

  # Backups
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  # Deletion protection (disable for demo)
  deletion_protection = false
  skip_final_snapshot = true

  # Performance Insights (free tier)
  performance_insights_enabled = true

  tags = {
    Name = "${var.app_name}-postgres"
  }
}
