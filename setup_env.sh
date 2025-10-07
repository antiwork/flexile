#!/bin/bash

# Flexile Development Environment Setup Script
# Run this with: source setup_env.sh

echo "🔧 Setting up Flexile development environment..."

# Initialize rbenv
if command -v rbenv &> /dev/null; then
    eval "$(rbenv init - zsh)"
    echo "✅ rbenv initialized"
fi

# Initialize nvm
export NVM_DIR="$HOME/.nvm"
if [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
    source "/opt/homebrew/opt/nvm/nvm.sh"
    echo "✅ nvm initialized"
fi

# Check Ruby version
echo ""
echo "📦 Current versions:"
echo "Ruby: $(ruby -v)"
echo "Bundler: $(bundle -v)"

# Check if we're in the right directory
if [ -f "backend/Gemfile" ]; then
    echo ""
    echo "✅ Flexile project detected"
    echo ""
    echo "Next steps:"
    echo "1. cd backend && bundle install"
    echo "2. rails db:create db:migrate db:seed"
    echo "3. cd .. && bin/dev"
else
    echo ""
    echo "⚠️  Please run this from the flexile project root directory"
fi
