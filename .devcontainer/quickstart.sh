#!/bin/bash

set -e

echo "🚀 Flexile Dev Container Quick Start"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.dev.yml" ]; then
    echo "❌ Please run this script from the Flexile project root directory"
    exit 1
fi

echo "This script will:"
echo "1. Create environment file from template"
echo "2. Start the dev container services"
echo ""

# read -p "Continue? (y/N) " -n 1 -r
# echo
# if [[ ! $REPLY =~ ^[Yy]$ ]]; then
#     echo "Aborted."
#     exit 0
# fi

# Run host setup
echo ""
echo "🔧 Setting up host machine..."
./.devcontainer/host-setup.sh

# Start dev container services
echo ""
echo "🐳 Starting dev container services..."
echo "This may take a few minutes on first run..."

docker compose -f docker-compose.dev.yml up -d --build

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
until docker compose -f docker-compose.dev.yml exec postgres pg_isready -U username -d flexile_development &> /dev/null; do
    sleep 1
done
echo "✅ PostgreSQL is ready"

# Wait for Redis
echo "Waiting for Redis..."
until docker compose -f docker-compose.dev.yml exec redis redis-cli ping &> /dev/null; do
    sleep 1
done
echo "✅ Redis is ready"

# Wait for Rails
echo "Waiting for Rails server..."
until curl -s http://localhost:3000 &> /dev/null; do
    sleep 2
done
echo "✅ Rails server is ready"

# Wait for Next.js
echo "Waiting for Next.js server..."
until curl -s http://localhost:3001 &> /dev/null; do
    sleep 2
done
echo "✅ Next.js server is ready"

echo ""
echo "🎉 Dev container is ready!"
echo ""
echo "Access your application at:"
echo "  🌐 Main App: https://flexile.dev"
echo "  🔧 Rails API: http://localhost:3000"
echo "  ⚡ Next.js: http://localhost:3001"
echo "  🎯 Inngest: http://localhost:8288"
echo ""
echo "Useful commands:"
echo "  📊 View logs: docker compose -f docker-compose.dev.yml logs -f"
echo "  🔄 Restart: docker compose -f docker-compose.dev.yml restart [service]"
echo "  🛑 Stop: docker compose -f docker-compose.dev.yml down"
echo ""
echo "For more details, see .devcontainer/README.md"
