#!/bin/bash
# Wait for core services before starting application services

set -e

# Function to check if service is ready
check_service() {
    local service=$1
    local host=$2
    local port=$3
    
    nc -z $host $port 2>/dev/null
}

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
while ! check_service "PostgreSQL" localhost 5432; do
    sleep 2
done
echo "PostgreSQL is ready"

# Wait for Redis
echo "Waiting for Redis..."
while ! check_service "Redis" localhost 6379; do
    sleep 2
done
echo "Redis is ready"

# Wait for MinIO
echo "Waiting for MinIO..."
while ! check_service "MinIO" localhost 9000; do
    sleep 2
done
echo "MinIO is ready"

# Run database migrations
echo "Running database migrations..."
cd /app/backend
bundle exec rails db:prepare

# Create MinIO buckets
echo "Creating MinIO buckets..."
/usr/local/bin/mc alias set local http://localhost:9000 minioadmin minioadmin123
/usr/local/bin/mc mb local/flexile-development-private --ignore-existing
/usr/local/bin/mc mb local/flexile-development-public --ignore-existing
/usr/local/bin/mc anonymous set download local/flexile-development-public
/usr/local/bin/mc anonymous set none local/flexile-development-private

echo "All services are ready!"

# Start application services
supervisorctl start rails
supervisorctl start sidekiq
supervisorctl start nextjs
supervisorctl start nginx

exit 0