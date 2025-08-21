#!/bin/bash

set -e

echo "🔒 Setting up SSL certificates for flexile.dev..."

# Create certificates directory
mkdir -p .certs

# Install mkcert if not already installed
if ! command -v mkcert &> /dev/null; then
    echo "📦 Installing mkcert..."

    # Detect OS and install mkcert accordingly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install mkcert nss
        else
            echo "❌ Homebrew not found. Please install mkcert manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
        chmod +x mkcert-v*-linux-amd64
        sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
    else
        echo "❌ Unsupported OS. Please install mkcert manually."
        exit 1
    fi
fi

# Install mkcert CA
echo "🔐 Installing mkcert CA..."
mkcert -install

# Generate certificates for flexile.dev
echo "📜 Generating certificates for flexile.dev..."
mkcert -key-file ./.certs/flexile.dev.key -cert-file ./.certs/flexile.dev.crt flexile.dev

# Set proper permissions
chmod 644 .certs/flexile.dev.crt
chmod 600 .certs/flexile.dev.key

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificates location:"
echo "   - Certificate: .certs/flexile.dev.crt"
echo "   - Private Key: .certs/flexile.dev.key"
