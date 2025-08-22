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
        unset SSL_CERT_FILE
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

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificates location:"
echo "   - Certificate: .certs/flexile.dev.crt"
echo "   - Private Key: .certs/flexile.dev.key"
echo "   - Combined CA certs: tmp/combined_ca_certs.pem"
