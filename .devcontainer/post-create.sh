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

# Enable corepack for pnpm
echo "📦 Enabling corepack for pnpm..."
corepack enable

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
pnpm install

# Install Ruby gems
echo "💎 Installing Ruby gems..."
cd backend
bundle install
cd ..

# Setup database
echo "🗄️ Setting up database..."
cd backend
bin/rails db:prepare
cd ..

echo "✨ Dev container setup complete!"
echo ""
echo "🚀 To start Flexile, run:"
echo "  docker compose -f docker-compose.dev.yml up"
echo ""
echo "🌐 Application will be available at: https://flexile.dev"
echo "🔧 Rails server: http://localhost:3000"
echo "⚡ Next.js server: http://localhost:3001"
echo "🎯 Inngest dashboard: http://localhost:8288"
echo ""
