#!/bin/bash

set -e

echo "🚀 Setting up host machine for Flexile dev container..."

# Check if running on supported OS
if [[ "$OSTYPE" != "darwin"* && "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script supports macOS and Linux only."
    exit 1
fi

# Generate SSL certificates
echo "🔒 Setting up SSL certificates..."
if [ ! -f ".certs/flexile.dev.crt" ] || [ ! -f ".certs/flexile.dev.key" ]; then
    ./.devcontainer/setup-certs.sh
else
    echo "✅ SSL certificates already exist"
fi

# Create environment file if it doesn't exist
echo "📝 Setting up environment file..."
if [ ! -f ".env.development" ]; then
    if [ -f ".devcontainer/env.development.template" ]; then
        cp .devcontainer/env.development.template .env.development
        echo "✅ Created .env.development from template"
        echo "📝 Please review and customize .env.development as needed"
    else
        echo "⚠️  .devcontainer/env.development.template not found. You'll need to create .env.development manually."
    fi
else
    echo "✅ .env.development already exists"
fi

# Check for Docker
echo "🐳 Checking Docker installation..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"

    # Check if Docker is running
    if docker info &> /dev/null; then
        echo "✅ Docker is running"
    else
        echo "⚠️  Docker is installed but not running. Please start Docker."
    fi
else
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/engine/install/"
fi

# Check for VS Code (optional)
echo "💻 Checking VS Code installation..."
if command -v code &> /dev/null; then
    echo "✅ VS Code is installed"

    # Check for Dev Containers extension
    if code --list-extensions | grep -q "ms-vscode-remote.remote-containers"; then
        echo "✅ Dev Containers extension is installed"
    else
        echo "📦 Installing Dev Containers extension..."
        code --install-extension ms-vscode-remote.remote-containers
    fi
else
    echo "⚠️  VS Code not found. You can still use the dev container with Docker Compose."
fi

echo ""
echo "🎉 Host setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and customize .env.development if needed"
echo "2. Open VS Code and use 'Dev Containers: Open Folder in Container'"
echo "   OR run: docker compose -f docker-compose.dev.yml up -d --build"
echo "3. Access the application at: https://flexile.dev"
echo ""
echo "For more details, see .devcontainer/README.md"
