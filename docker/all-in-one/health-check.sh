#!/bin/bash
# Health check script for all-in-one container

# Check core services
check_service() {
    local service=$1
    local check_command=$2
    
    if eval "$check_command" 2>/dev/null; then
        echo "✅ $service: healthy"
        return 0
    else
        echo "❌ $service: unhealthy"
        return 1
    fi
}

# Track overall health
HEALTHY=true

# Check PostgreSQL
check_service "PostgreSQL" "pg_isready -h localhost -p 5432 -U username" || HEALTHY=false

# Check Redis
check_service "Redis" "redis-cli ping | grep -q PONG" || HEALTHY=false

# Check MinIO
check_service "MinIO" "curl -sf http://localhost:9000/minio/health/live" || HEALTHY=false

# Check Rails
check_service "Rails" "curl -sf http://localhost:3000/health" || HEALTHY=false

# Check Next.js
check_service "Next.js" "curl -sf http://localhost:3001" || HEALTHY=false

# Check Nginx
check_service "Nginx" "curl -sf http://localhost:80" || HEALTHY=false

# Check Sidekiq (via Rails endpoint or Redis)
check_service "Sidekiq" "redis-cli -n 1 ping | grep -q PONG" || HEALTHY=false

# Return appropriate exit code
if [ "$HEALTHY" = true ]; then
    echo "🎉 All services are healthy"
    exit 0
else
    echo "⚠️ Some services are unhealthy"
    exit 1
fi