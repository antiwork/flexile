#!/bin/bash

set -e

echo "🚀 Setting up Flexile development environment in dev container..."

# Copy environment file if it doesn't exist
if [ ! -f ".env.development" ]; then
    echo "📝 Creating .env.development from template..."
    cp .devcontainer/env.development.template .env.development
    echo "✅ Environment file created"
fi

# Create symlink for frontend
echo "🔗 Creating symlink for frontend .env..."
ln -sf /workspaces/flexile/.env.development /workspaces/flexile/frontend/.env

# Add flexile.dev to /etc/hosts if not present
if ! grep -q "flexile.dev" /etc/hosts; then
    echo "🌐 Adding flexile.dev to /etc/hosts..."
    echo "127.0.0.1 flexile.dev" | sudo tee -a /etc/hosts
fi

# Generate SSL certificates
echo "🔒 Generating SSL certificates..."
mkdir -p .certs
cd /workspaces/flexile

# Install mkcert if not already installed
if ! command -v mkcert &> /dev/null; then
    echo "📦 Installing mkcert..."
    curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
    chmod +x mkcert-v*-linux-amd64
    sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
fi

# Install mkcert CA
echo "🔐 Installing mkcert CA..."
mkcert -install

# Generate certificates
echo "📜 Generating certificates for flexile.dev..."
mkcert -key-file ./.certs/flexile.dev.key -cert-file ./.certs/flexile.dev.crt flexile.dev

# Set proper permissions
chmod 644 .certs/flexile.dev.crt
chmod 600 .certs/flexile.dev.key

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
echo "🌐 Application will be available at: https://flexile.dev"
echo "🔧 Rails server: http://localhost:3000"
echo "⚡ Next.js server: http://localhost:3001"
echo "🎯 Inngest dashboard: http://localhost:8288"
echo ""
echo "To start the application, run: docker compose -f docker-compose.dev.yml up"
