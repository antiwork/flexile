#!/bin/bash

set -e

echo "🚀 Setting up Flexile development environment in dev container..."

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "✅ Environment file created"
fi

# Create symlink for frontend
echo "🔗 Creating symlink for frontend .env..."
ln -sf /workspaces/flexile/.env /workspaces/flexile/frontend/.env

# Add flexile.dev to /etc/hosts if not present
if ! grep -q "flexile.dev" /etc/hosts; then
    echo "🌐 Adding flexile.dev to /etc/hosts..."
    echo "127.0.0.1 flexile.dev" | sudo tee -a /etc/hosts
fi

# Generate SSL certificates using the setup script
echo "🔒 Setting up SSL certificates..."
bash .devcontainer/setup-certs.sh

echo "Starting services..."
docker compose -f docker-compose.dev.yml up -d

echo "✨ Dev container setup complete!"
echo "🌐 Application will be available at: https://flexile.dev"
echo "🔧 Rails server: http://localhost:3000"
echo "⚡ Next.js server: http://localhost:3001"
echo "🎯 Inngest dashboard: http://localhost:8288"
echo ""
echo "Useful commands:"
echo "  📊 View logs: docker compose -f docker-compose.dev.yml logs -f"
echo "  🔄 Restart: docker compose -f docker-compose.dev.yml restart [service]"
echo "  🛑 Stop: docker compose -f docker-compose.dev.yml down"
echo ""