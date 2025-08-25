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
echo "🌐 Application will be available at: http://localhost:3000"
echo "🔧 Rails API server: http://localhost:3001"
echo "🎯 Inngest dashboard: http://localhost:8288"
echo ""
echo "To start the application, run: docker compose -f docker-compose.dev.yml up"
