#!/usr/bin/env bash
# generate-certificates.sh - Generate SSL certificates for development environment
# Uses mkcert or openssl to generate self-signed certificates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"
CERT_DIR="$PROJECT_ROOT/certificates"

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if mkcert is installed
check_mkcert() {
    if command -v mkcert &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to generate certificate with mkcert
generate_with_mkcert() {
    local domain=$1
    local subdomains=("$domain" "app.$domain" "api.$domain" "minio.$domain" "minio-console.$domain" "test.$domain" "*.$domain" "localhost")
    
    print_message "$YELLOW" "🔐 Generating certificates with mkcert for $domain..."
    
    # Install local CA if not already installed
    mkcert -install
    
    # Create certificate directories
    for subdomain in "${subdomains[@]}"; do
        local cert_name="${subdomain//\*./wildcard.}"
        mkdir -p "$CERT_DIR/$cert_name"
    done
    
    # Generate main certificate
    cd "$CERT_DIR/$domain"
    mkcert -cert-file localhost.pem -key-file localhost-key.pem "$domain" "*.${domain}" localhost 127.0.0.1 ::1
    
    # Copy certificates to subdomain directories
    for subdomain in "${subdomains[@]}"; do
        if [[ "$subdomain" != "$domain" ]]; then
            local cert_name="${subdomain//\*./wildcard.}"
            cp "$CERT_DIR/$domain/localhost.pem" "$CERT_DIR/$cert_name/"
            cp "$CERT_DIR/$domain/localhost-key.pem" "$CERT_DIR/$cert_name/"
        fi
    done
    
    print_message "$GREEN" "✅ Certificates generated with mkcert"
}

# Function to generate certificate with openssl
generate_with_openssl() {
    local domain=$1
    local subdomains=("$domain" "app.$domain" "api.$domain" "minio.$domain" "minio-console.$domain" "test.$domain")
    
    print_message "$YELLOW" "🔐 Generating self-signed certificates with openssl for $domain..."
    
    # Create certificate directories
    for subdomain in "${subdomains[@]}"; do
        mkdir -p "$CERT_DIR/$subdomain"
    done
    
    # Create openssl config
    cat > /tmp/openssl.cnf <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=California
L=San Francisco
O=Flexile Development
OU=Development
CN=$domain

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = $domain
DNS.2 = *.$domain
DNS.3 = localhost
DNS.4 = app.$domain
DNS.5 = api.$domain
DNS.6 = minio.$domain
DNS.7 = minio-console.$domain
DNS.8 = test.$domain
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
    
    # Generate certificate for main domain
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/$domain/localhost-key.pem" \
        -out "$CERT_DIR/$domain/localhost.pem" \
        -config /tmp/openssl.cnf \
        -extensions v3_req
    
    # Copy certificates to subdomain directories
    for subdomain in "${subdomains[@]}"; do
        if [[ "$subdomain" != "$domain" ]]; then
            cp "$CERT_DIR/$domain/localhost.pem" "$CERT_DIR/$subdomain/"
            cp "$CERT_DIR/$domain/localhost-key.pem" "$CERT_DIR/$subdomain/"
        fi
    done
    
    # Clean up
    rm -f /tmp/openssl.cnf
    
    print_message "$GREEN" "✅ Self-signed certificates generated with openssl"
    print_message "$YELLOW" "⚠️  Note: You may need to trust these certificates in your browser"
}

# Function to trust certificates on macOS
trust_certificates_macos() {
    local domain=$1
    local cert_file="$CERT_DIR/$domain/localhost.pem"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_message "$YELLOW" "🔒 Adding certificate to macOS keychain..."
        sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$cert_file" 2>/dev/null || true
        print_message "$GREEN" "✅ Certificate added to macOS keychain"
    fi
}

# Main function
generate_certificates() {
    local domain=${1:-flexile.dev}
    
    print_message "$GREEN" "🚀 Generating SSL certificates for domain: $domain"
    
    # Create certificates directory
    mkdir -p "$CERT_DIR"
    
    # Check if certificates already exist
    if [ -f "$CERT_DIR/$domain/localhost.pem" ] && [ -f "$CERT_DIR/$domain/localhost-key.pem" ]; then
        print_message "$GREEN" "✅ Certificates already exist for $domain"
        # Only regenerate if explicitly forced with --force flag
        if [ "${2:-}" != "--force" ]; then
            return 0
        fi
        print_message "$YELLOW" "⚠️  Force regenerating certificates..."
    fi
    
    # Generate certificates
    if check_mkcert; then
        generate_with_mkcert "$domain"
    else
        print_message "$YELLOW" "⚠️  mkcert not found, using openssl instead"
        print_message "$YELLOW" "💡 Install mkcert for better certificate management:"
        print_message "$YELLOW" "   brew install mkcert (macOS)"
        print_message "$YELLOW" "   apt install mkcert (Linux)"
        generate_with_openssl "$domain"
    fi
    
    # Trust certificates on macOS
    trust_certificates_macos "$domain"
    
    # Set proper permissions
    find "$CERT_DIR" -type f -name "*.pem" -exec chmod 644 {} \;
    find "$CERT_DIR" -type f -name "*-key.pem" -exec chmod 600 {} \;
    
    print_message "$GREEN" "✅ SSL certificates generated successfully"
    print_message "$YELLOW" "📁 Certificates location: $CERT_DIR"
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    generate_certificates "flexile.dev"
else
    generate_certificates "$1"
fi