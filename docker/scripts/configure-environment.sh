#!/usr/bin/env bash
# configure-environment.sh - Environment configuration and templating script
# This script handles domain configuration and template generation for Docker environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DEFAULT_DOMAIN="flexile.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"

# Load environment variables
if [ -f "$DOCKER_DIR/.env.docker" ]; then
    source "$DOCKER_DIR/.env.docker"
fi

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to validate domain
validate_domain() {
    local domain=$1
    if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$ ]] && [[ "$domain" != "localhost" ]]; then
        print_message "$RED" "❌ Invalid domain format: $domain"
        return 1
    fi
    return 0
}

# Function to update environment file
update_env_file() {
    local file=$1
    local key=$2
    local value=$3
    
    # Resolve symbolic links
    if [ -L "$file" ]; then
        file=$(readlink -f "$file" 2>/dev/null || readlink "$file")
    fi
    
    if [ -f "$file" ]; then
        # Check if key exists
        if grep -q "^${key}=" "$file"; then
            # Update existing key using a temp file for better compatibility
            local temp_file="${file}.tmp$$"
            sed "s|^${key}=.*|${key}=${value}|" "$file" > "$temp_file"
            mv "$temp_file" "$file"
        else
            # Add new key
            echo "${key}=${value}" >> "$file"
        fi
    else
        # Create new file with key
        echo "${key}=${value}" > "$file"
    fi
}

# Function to template a file
template_file() {
    local template=$1
    local output=$2
    local domain=${FLEXILE_DOMAIN:-$DEFAULT_DOMAIN}
    
    print_message "$YELLOW" "📝 Templating: $output"
    
    # Create backup if output exists
    if [ -f "$output" ]; then
        cp "$output" "${output}.backup"
    fi
    
    # Perform substitutions
    sed -e "s|\${FLEXILE_DOMAIN}|$domain|g" \
        -e "s|\${FLEXILE_APP_DOMAIN}|app.$domain|g" \
        -e "s|\${FLEXILE_API_DOMAIN}|api.$domain|g" \
        -e "s|\${FLEXILE_MINIO_DOMAIN}|minio.$domain|g" \
        -e "s|\${FLEXILE_MINIO_CONSOLE_DOMAIN}|minio-console.$domain|g" \
        -e "s|\${FLEXILE_TEST_DOMAIN}|test.$domain|g" \
        -e "s|flexile\.dev|$domain|g" \
        -e "s|app\.flexile\.dev|app.$domain|g" \
        -e "s|api\.flexile\.dev|api.$domain|g" \
        -e "s|minio\.flexile\.dev|minio.$domain|g" \
        -e "s|minio-console\.flexile\.dev|minio-console.$domain|g" \
        -e "s|test\.flexile\.dev|test.$domain|g" \
        "$template" > "$output"
    
    print_message "$GREEN" "✅ Templated: $output"
}

# Main configuration function
configure_environment() {
    local domain=${1:-$DEFAULT_DOMAIN}
    
    print_message "$GREEN" "🚀 Configuring environment for domain: $domain"
    
    # Validate domain
    if ! validate_domain "$domain"; then
        exit 1
    fi
    
    # Update Docker environment file
    update_env_file "$DOCKER_DIR/.env.docker" "FLEXILE_DOMAIN" "$domain"
    
    # Update root .env file
    if [ -f "$PROJECT_ROOT/.env" ]; then
        update_env_file "$PROJECT_ROOT/.env" "FLEXILE_DOMAIN" "$domain"
        update_env_file "$PROJECT_ROOT/.env" "DOMAIN" "$domain"
        update_env_file "$PROJECT_ROOT/.env" "APP_DOMAIN" "app.$domain"
        update_env_file "$PROJECT_ROOT/.env" "AWS_ENDPOINT_URL" "https://minio.$domain"
    fi
    
    # Update frontend .env if it exists (handle symbolic links)
    if [ -f "$PROJECT_ROOT/frontend/.env" ] || [ -L "$PROJECT_ROOT/frontend/.env" ]; then
        update_env_file "$PROJECT_ROOT/frontend/.env" "NEXT_PUBLIC_DOMAIN" "$domain"
        update_env_file "$PROJECT_ROOT/frontend/.env" "NEXT_PUBLIC_API_URL" "https://api.$domain"
    fi
    
    # Create nginx configuration from template
    if [ -f "$DOCKER_DIR/flexile_dev.conf.template" ]; then
        template_file "$DOCKER_DIR/flexile_dev.conf.template" "$DOCKER_DIR/flexile_dev.conf"
    fi
    
    # Update mise.toml AWS_ENDPOINT_URL
    if [ -f "$PROJECT_ROOT/mise.toml" ]; then
        local temp_file="${PROJECT_ROOT}/mise.toml.tmp$$"
        sed "s|AWS_ENDPOINT_URL = \"https://[^\"]*\"|AWS_ENDPOINT_URL = \"https://minio.$domain\"|" "$PROJECT_ROOT/mise.toml" > "$temp_file"
        mv "$temp_file" "$PROJECT_ROOT/mise.toml"
    fi
    
    print_message "$GREEN" "✅ Environment configured for domain: $domain"
    print_message "$YELLOW" "📌 Domains configured:"
    echo "   - Main: https://$domain"
    echo "   - App: https://app.$domain"
    echo "   - API: https://api.$domain"
    echo "   - MinIO: https://minio.$domain"
    echo "   - MinIO Console: https://minio-console.$domain"
    echo "   - Test: https://test.$domain"
    
    # Generate certificates if needed
    if [ ! -f "$PROJECT_ROOT/certificates/$domain/localhost.pem" ] || [ ! -f "$PROJECT_ROOT/certificates/$domain/localhost-key.pem" ]; then
        print_message "$YELLOW" "🔐 Generating SSL certificates for $domain..."
        "$SCRIPT_DIR/generate-certificates.sh" "$domain"
    else
        print_message "$GREEN" "✅ SSL certificates already exist for $domain"
    fi
}

# Parse command line arguments
case "${1:-}" in
    --domain|-d)
        configure_environment "${2:-$DEFAULT_DOMAIN}"
        ;;
    --help|-h)
        echo "Usage: $0 [--domain <domain>]"
        echo ""
        echo "Options:"
        echo "  --domain, -d <domain>  Configure environment for specified domain (default: flexile.dev)"
        echo "  --help, -h            Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                    # Use default domain (flexile.dev)"
        echo "  $0 --domain myapp.local  # Use custom domain"
        ;;
    *)
        configure_environment "$DEFAULT_DOMAIN"
        ;;
esac