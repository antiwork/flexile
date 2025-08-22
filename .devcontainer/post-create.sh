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

# Create combined certificate file for SSL environment variables
echo "🔗 Creating combined certificate file..."
mkdir -p tmp
default_cert_file=$(ruby -ropenssl -e 'puts OpenSSL::X509::DEFAULT_CERT_FILE' 2>/dev/null || echo "/etc/ssl/certs/ca-certificates.crt")
mkcert_ca_file="$(mkcert -CAROOT)/rootCA.pem"
combined_cert_file="tmp/combined_ca_certs.pem"

if [ -f "$default_cert_file" ] && [ -f "$mkcert_ca_file" ]; then
  cat "$default_cert_file" "$mkcert_ca_file" > "$combined_cert_file"
  echo "✅ Combined certificates created at $combined_cert_file"
else
  echo "⚠️  Warning: Could not create combined cert file. Using default certificates."
  if [ -f "$mkcert_ca_file" ]; then
    cp "$mkcert_ca_file" "$combined_cert_file"
    echo "✅ Using mkcert CA certificate"
  fi
fi

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
