#!/bin/bash
# All-in-One Container Initialization Script
# Prepares environment and starts supervisor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Initializing Flexile All-in-One Container${NC}"

# Function to wait for a service
wait_for_service() {
    local service=$1
    local host=$2
    local port=$3
    local max_attempts=30
    local attempt=0
    
    echo -e "${YELLOW}⏳ Waiting for $service on $host:$port...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            echo -e "${GREEN}✅ $service is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo -e "${RED}❌ $service failed to start${NC}"
    return 1
}

# Initialize PostgreSQL if needed
if [ ! -d "$PGDATA/base" ]; then
    echo -e "${YELLOW}🗄️ Initializing PostgreSQL database...${NC}"
    chown -R postgres:postgres /var/lib/postgresql
    chmod 700 /var/lib/postgresql/data
    su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D $PGDATA"
    
    # Start PostgreSQL temporarily to create users and databases
    su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D $PGDATA start"
    sleep 5
    
    su - postgres -c "psql -c \"CREATE USER username WITH SUPERUSER PASSWORD 'password';\""
    su - postgres -c "createdb -O username flexile_development"
    su - postgres -c "createdb -O username flexile_test"
    
    su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D $PGDATA stop"
    echo -e "${GREEN}✅ PostgreSQL initialized${NC}"
fi

# Initialize MinIO data directory
if [ ! -d "/var/lib/minio/.minio.sys" ]; then
    echo -e "${YELLOW}🪣 Initializing MinIO storage...${NC}"
    mkdir -p /var/lib/minio
    chown -R root:root /var/lib/minio
fi

# Initialize Redis data directory
if [ ! -d "/var/lib/redis" ]; then
    echo -e "${YELLOW}💾 Initializing Redis...${NC}"
    mkdir -p /var/lib/redis
    chown -R redis:redis /var/lib/redis
fi

# Generate SSL certificates if not present
if [ ! -d "/app/certificates" ] || [ ! -f "/app/certificates/flexile.dev/localhost.pem" ]; then
    echo -e "${YELLOW}🔐 Generating SSL certificates...${NC}"
    mkdir -p /app/certificates
    cd /app/docker
    if [ -f "createCertificate.js" ]; then
        node createCertificate.js
    else
        # Fallback to openssl
        /app/docker/scripts/generate-certificates.sh flexile.dev
    fi
    echo -e "${GREEN}✅ SSL certificates generated${NC}"
fi

# Configure Nginx with certificates
echo -e "${YELLOW}🔧 Configuring Nginx...${NC}"
if [ -f "/app/docker/flexile_dev.conf" ]; then
    cp /app/docker/flexile_dev.conf /etc/nginx/sites-available/default
    # Replace domain placeholders if needed
    sed -i "s/\${FLEXILE_DOMAIN}/flexile.dev/g" /etc/nginx/sites-available/default
    sed -i "s/\${FLEXILE_APP_DOMAIN}/app.flexile.dev/g" /etc/nginx/sites-available/default
    sed -i "s/\${FLEXILE_API_DOMAIN}/api.flexile.dev/g" /etc/nginx/sites-available/default
    sed -i "s/\${FLEXILE_MINIO_DOMAIN}/minio.flexile.dev/g" /etc/nginx/sites-available/default
    sed -i "s/\${FLEXILE_MINIO_CONSOLE_DOMAIN}/minio-console.flexile.dev/g" /etc/nginx/sites-available/default
fi

# Test Nginx configuration
nginx -t

# Setup Rails application
echo -e "${YELLOW}🚂 Preparing Rails application...${NC}"
cd /app/backend

# Install dependencies if needed
if [ ! -d "vendor/bundle" ]; then
    bundle install --jobs 4 --retry 3
fi

# Setup Next.js application
echo -e "${YELLOW}⚛️ Preparing Next.js application...${NC}"
cd /app/frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    pnpm install --frozen-lockfile
fi

# Build Next.js for better performance (optional)
# pnpm build

# Create environment symlink
if [ ! -L "/app/frontend/.env" ] && [ -f "/app/.env" ]; then
    ln -sf /app/.env /app/frontend/.env
fi

# Start supervisor
echo -e "${GREEN}🎯 Starting Supervisor to manage all services...${NC}"
echo -e "${YELLOW}📊 Services will start in this order:${NC}"
echo "  1. PostgreSQL (database)"
echo "  2. Redis (cache)"
echo "  3. MinIO (object storage)"
echo "  4. Rails (backend API)"
echo "  5. Sidekiq (background jobs)"
echo "  6. Next.js (frontend)"
echo "  7. Nginx (reverse proxy)"

# Start supervisor in foreground
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf