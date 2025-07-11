# Flexile Development Makefile
# A comprehensive build system for the Flexile full-stack application

# Colors for help output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
RESET := \033[0m
BOLD := \033[1m

# Project configuration
SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help install dev test lint clean local stop_local .setup ghpr

# Detect OS
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
    OS := linux
    DISTRO := $(shell lsb_release -si 2>/dev/null || echo "Unknown")
endif
ifeq ($(UNAME_S),Darwin)
    OS := macos
endif

# Required versions
NODE_VERSION := 22.14.0
RUBY_VERSION := 3.4.3
PNPM_VERSION := 10.8.0

# Directories
BACKEND_DIR := backend
FRONTEND_DIR := frontend

# Docker configuration
COMPOSE_PROJECT_NAME ?= flexile
DOCKER_COMPOSE_CMD ?= docker compose
LOCAL_DETACHED ?= true
LOCAL_DOCKER_COMPOSE_CONFIG = $(if $(and $(filter Linux,$(shell uname -s)),$(shell test ! -e /proc/sys/fs/binfmt_misc/WSLInterop && echo true)),docker-compose-local-linux.yml,docker-compose-local.yml)

#########################
# Help System
#########################

help: ## Show this help message
	@echo ""
	@printf "$(BOLD)$(CYAN)🚀 Flexile Development Makefile$(RESET)\n"
	@printf "$(CYAN)================================$(RESET)\n"
	@echo ""
	@printf "$(GREEN)📋 Available targets:$(RESET)\n"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[0;36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@printf "$(YELLOW)⚡ Quick Start:$(RESET)\n"
	@printf "  1. Run '$(CYAN)make install$(RESET)' to set up the project\n"
	@printf "  2. Run '$(CYAN)make dev$(RESET)' to start development servers\n"
	@printf "  3. Run '$(CYAN)make test$(RESET)' to run all tests\n"
	@echo ""

#########################
# System Checks
#########################

check-node: ## 🟢 Check Node.js version
	@printf "$(YELLOW)🔍 Checking Node.js version...$(RESET)\n"
	@if command -v node >/dev/null 2>&1; then \
		CURRENT_NODE=$$(node -v | sed 's/v//'); \
		if [ "$$(printf '%s\n' "$(NODE_VERSION)" "$$CURRENT_NODE" | sort -V | head -n1)" = "$(NODE_VERSION)" ]; then \
			printf "$(GREEN)✅ Node.js $$CURRENT_NODE is installed$(RESET)\n"; \
		else \
			printf "$(RED)❌ Node.js $(NODE_VERSION) is required, but $$CURRENT_NODE is installed$(RESET)\n"; \
			printf "\n$(YELLOW)💡 Attempting to fix Node.js version...$(RESET)\n"; \
			$(MAKE) fix-node-version; \
		fi \
	else \
		printf "$(RED)❌ Node.js is not installed$(RESET)\n"; \
		printf "\n$(YELLOW)💡 Installing Node.js $(NODE_VERSION)...$(RESET)\n"; \
		$(MAKE) install-node; \
	fi

fix-node-version: ## 🔧 Fix Node.js version using nvm
	@if command -v nvm >/dev/null 2>&1 || [ -s "$$NVM_DIR/nvm.sh" ] || [ -s "$$HOME/.nvm/nvm.sh" ]; then \
		printf "$(CYAN)🔄 Switching to Node.js $(NODE_VERSION) using nvm...$(RESET)\n"; \
		if [ -s "$$NVM_DIR/nvm.sh" ]; then \
			. "$$NVM_DIR/nvm.sh"; \
		elif [ -s "$$HOME/.nvm/nvm.sh" ]; then \
			. "$$HOME/.nvm/nvm.sh"; \
		fi; \
		nvm install $(NODE_VERSION) || true; \
		nvm use $(NODE_VERSION) || true; \
		nvm alias default $(NODE_VERSION) || true; \
		printf "$(GREEN)✅ Node.js version updated. Please restart your terminal or run:$(RESET)\n"; \
		printf "$(CYAN)   source ~/.bashrc  # or ~/.zshrc$(RESET)\n"; \
	else \
		printf "$(YELLOW)📦 Installing nvm first...$(RESET)\n"; \
		$(MAKE) install-nvm; \
		printf "$(CYAN)After nvm installation, run: make fix-node-version$(RESET)\n"; \
	fi

install-nvm: ## 📦 Install nvm (Node Version Manager)
	@printf "$(CYAN)📦 Installing nvm...$(RESET)\n"
	@curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
	@printf "$(GREEN)✅ nvm installed$(RESET)\n"
	@printf "$(YELLOW)⚠️  Please restart your terminal or run:$(RESET)\n"
	@if [[ "$(OS)" == "macos" ]]; then \
		printf "$(CYAN)   source ~/.zshrc$(RESET)\n"; \
	else \
		printf "$(CYAN)   source ~/.bashrc$(RESET)\n"; \
	fi
	@printf "$(CYAN)   Then run: make fix-node-version$(RESET)\n"

install-node: ## 🟢 Install Node.js using nvm
	@printf "$(CYAN)🟢 Installing Node.js $(NODE_VERSION)...$(RESET)\n"
	@if command -v nvm >/dev/null 2>&1 || [ -s "$$NVM_DIR/nvm.sh" ] || [ -s "$$HOME/.nvm/nvm.sh" ]; then \
		printf "$(CYAN)Using existing nvm installation...$(RESET)\n"; \
		$(MAKE) fix-node-version; \
	else \
		printf "$(YELLOW)nvm not found. Installing nvm first...$(RESET)\n"; \
		$(MAKE) install-nvm; \
	fi

check-ruby: ## 💎 Check Ruby version
	@printf "$(YELLOW)🔍 Checking Ruby version...$(RESET)\n"
	@if command -v ruby >/dev/null 2>&1; then \
		CURRENT_RUBY=$$(ruby -v | awk '{print $$2}'); \
		if [ "$$(printf '%s\n' "$(RUBY_VERSION)" "$$CURRENT_RUBY" | sort -V | head -n1)" = "$(RUBY_VERSION)" ]; then \
			printf "$(GREEN)✅ Ruby $$CURRENT_RUBY is installed$(RESET)\n"; \
		else \
			printf "$(RED)❌ Ruby $(RUBY_VERSION) is required, but $$CURRENT_RUBY is installed$(RESET)\n"; \
			printf "\n$(YELLOW)💡 Please install Ruby $(RUBY_VERSION)$(RESET)\n"; \
			exit 1; \
		fi \
	else \
		printf "$(RED)❌ Ruby is not installed$(RESET)\n"; \
		printf "\n$(YELLOW)💡 To install Ruby $(RUBY_VERSION):$(RESET)\n"; \
		if [[ "$(OS)" == "macos" ]]; then \
			printf "$(CYAN)   On macOS:$(RESET)\n"; \
			printf "     brew install rbenv ruby-build\n"; \
			printf "     rbenv install $(RUBY_VERSION)\n"; \
			printf "     rbenv global $(RUBY_VERSION)\n"; \
		elif [[ "$(OS)" == "linux" ]]; then \
			printf "$(CYAN)   On Linux:$(RESET)\n"; \
			if [[ "$(DISTRO)" == "Ubuntu" ]] || [[ "$(DISTRO)" == "Debian" ]]; then \
				printf "     sudo apt update\n"; \
				printf "     sudo apt install rbenv ruby-build\n"; \
			elif [[ "$(DISTRO)" == "Fedora" ]] || [[ "$(DISTRO)" == "CentOS" ]]; then \
				printf "     sudo dnf install rbenv ruby-build\n"; \
			else \
				printf "     # Install rbenv and ruby-build for your distribution\n"; \
			fi; \
			printf "     rbenv install $(RUBY_VERSION)\n"; \
			printf "     rbenv global $(RUBY_VERSION)\n"; \
		else \
			printf "     # Please install Ruby $(RUBY_VERSION) for your operating system\n"; \
		fi; \
		printf "\n$(YELLOW)⚠️  After installation, restart your terminal$(RESET)\n"; \
		exit 1; \
	fi

check-pnpm: ## 📦 Check pnpm installation
	@printf "$(YELLOW)🔍 Checking pnpm...$(RESET)\n"
	@if command -v pnpm >/dev/null 2>&1; then \
		CURRENT_PNPM=$$(pnpm -v); \
		printf "$(GREEN)✅ pnpm $$CURRENT_PNPM is installed$(RESET)\n"; \
	else \
		printf "$(RED)❌ pnpm is not installed$(RESET)\n"; \
		printf "\n$(YELLOW)💡 To install pnpm:$(RESET)\n"; \
		if command -v corepack >/dev/null 2>&1; then \
			printf "$(CYAN)   Using corepack (recommended):$(RESET)\n"; \
			printf "     corepack enable\n"; \
			printf "     corepack prepare pnpm@$(PNPM_VERSION) --activate\n"; \
		else \
			printf "$(CYAN)   Using npm:$(RESET)\n"; \
			printf "     npm install -g pnpm@$(PNPM_VERSION)\n"; \
		fi; \
		printf "\n$(YELLOW)⚠️  Note: You may need to restart your terminal$(RESET)\n"; \
		exit 1; \
	fi

check-docker: ## 🐳 Check Docker installation
	@printf "$(YELLOW)🔍 Checking Docker...$(RESET)\n"
	@if command -v docker >/dev/null 2>&1; then \
		if docker info >/dev/null 2>&1; then \
			DOCKER_VERSION=$$(docker --version | awk '{print $$3}' | sed 's/,//'); \
			printf "$(GREEN)✅ Docker $$DOCKER_VERSION is installed and running$(RESET)\n"; \
		else \
			printf "$(RED)❌ Docker is installed but not running$(RESET)\n"; \
			printf "\n$(YELLOW)💡 To fix this issue:$(RESET)\n"; \
			if [[ "$$(uname)" == "Darwin" ]]; then \
				printf "$(CYAN)   On macOS:$(RESET)\n"; \
				printf "     open -a Docker\n"; \
				printf "     # Or start Docker Desktop from Applications\n"; \
			else \
				printf "$(CYAN)   On Linux:$(RESET)\n"; \
				printf "     sudo systemctl start docker\n"; \
				printf "     sudo systemctl enable docker\n"; \
			fi; \
			exit 1; \
		fi \
	else \
		printf "$(RED)❌ Docker is not installed$(RESET)\n"; \
		printf "\n$(YELLOW)💡 To install Docker:$(RESET)\n"; \
		printf "$(CYAN)   Visit: https://www.docker.com/products/docker-desktop$(RESET)\n"; \
		printf "\n$(CYAN)   Or use brew on macOS:$(RESET)\n"; \
		printf "     brew install --cask docker\n"; \
		exit 1; \
	fi

check-env: ## 🔐 Check for .env file
	@printf "$(YELLOW)🔍 Checking environment configuration...$(RESET)\n"
	@if [ -f .env ]; then \
		printf "$(GREEN)✅ .env file exists$(RESET)\n"; \
	else \
		printf "$(YELLOW)⚠️  .env file not found$(RESET)\n"; \
		if [ -f .env.example ]; then \
			printf "$(CYAN)📝 Creating .env from .env.example...$(RESET)\n"; \
			cp .env.example .env; \
			printf "$(GREEN)✅ Created .env file$(RESET)\n"; \
			printf "$(YELLOW)💡 Please update .env with your configuration$(RESET)\n"; \
		else \
			printf "$(RED)❌ No .env.example file found$(RESET)\n"; \
			exit 1; \
		fi \
	fi

check-all: check-node check-ruby check-pnpm check-docker check-env ## 🔍 Run all system checks

#########################
# Installation
#########################

install-deps: ## 📥 Install Node.js and Ruby dependencies
	@printf "$(CYAN)📦 Installing dependencies...$(RESET)\n"
	@printf "$(YELLOW)🟢 Installing Node.js dependencies with pnpm...$(RESET)\n"
	pnpm install
	@printf "$(YELLOW)💎 Installing Ruby dependencies with bundler...$(RESET)\n"
	cd $(BACKEND_DIR) && bundle install

install-brew-deps: ## Install Homebrew dependencies
	@echo "$(CYAN)Installing Homebrew dependencies...$(RESET)"
	@if command -v brew >/dev/null 2>&1; then \
		brew bundle check || brew bundle; \
	else \
		echo "$(YELLOW)Homebrew not found. Installing required packages manually...$(RESET)"; \
		echo "$(RED)Please install: postgresql@16, redis, imagemagick, nginx$(RESET)"; \
	fi

.setup: ## 🔧 Setup Docker directories
	@mkdir -p docker/tmp/postgres
	@mkdir -p docker/tmp/redis

setup-ssl: ## 🔒 Generate SSL certificates for local development
	@printf "$(CYAN)🔒 Setting up SSL certificates...$(RESET)\n"
	@mkdir -p nginx/ssl
	@if [ ! -f nginx/ssl/flexile.crt ]; then \
		openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
			-keyout nginx/ssl/flexile.key \
			-out nginx/ssl/flexile.crt \
			-subj "/C=US/ST=State/L=City/O=Flexile/CN=flexile.dev"; \
		printf "$(GREEN)✅ SSL certificates created$(RESET)\n"; \
	else \
		printf "$(GREEN)✅ SSL certificates already exist$(RESET)\n"; \
	fi

setup-db: ## 🗄️  Set up the database
	@printf "$(CYAN)🗄️  Setting up database...$(RESET)\n"
	cd $(BACKEND_DIR) && bundle exec rails db:create db:migrate db:seed

install: check-all install-brew-deps install-deps setup-ssl setup-db ## 🚀 Complete installation process
	@echo ""
	@printf "$(GREEN)🎉 Installation complete!$(RESET)\n"
	@echo ""
	@printf "$(CYAN)📋 Next steps:$(RESET)\n"
	@printf "  1. Update your .env file with required API keys\n"
	@printf "  2. Run '$(CYAN)make dev$(RESET)' to start the development servers\n"
	@echo ""

#########################
# Development
#########################

docker-up: .setup ## 🐳 Start Docker services
	@printf "$(CYAN)🐳 Starting Docker services...$(RESET)\n"
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) up -d
	@printf "$(GREEN)✅ Docker services started$(RESET)\n"

docker-down: ## 🛑 Stop Docker services
	@printf "$(CYAN)🛑 Stopping Docker services...$(RESET)\n"
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) down
	@printf "$(GREEN)✅ Docker services stopped$(RESET)\n"

stop_local: docker-down ## 🛑 Stop local development environment (alias)
	@printf "$(CYAN)🛑 Local development environment stopped$(RESET)\n"

docker-logs: ## 📋 Show Docker service logs
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) logs -f

kill-ports: ## 🚫 Kill processes on development ports
	@printf "$(CYAN)🚫 Killing processes on ports 3000, 3001, 8288...$(RESET)\n"
	@lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:3001 | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:8288 | xargs -r kill -9 2>/dev/null || true
	@printf "$(GREEN)✅ Ports cleared$(RESET)\n"

local: .setup ## 🏠 Start local development environment
	@printf "$(CYAN)🏠 Starting local development environment...$(RESET)\n"
	node docker/createCertificate.js
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) up $(if $(filter true,$(LOCAL_DETACHED)),-d)
	@printf "$(GREEN)✅ Local development environment started$(RESET)\n"

dev: ensure-node-version docker-up kill-ports ## 🚀 Start development servers
	@printf "$(CYAN)🚀 Starting development servers...$(RESET)\n"
	@if [ -s "$$NVM_DIR/nvm.sh" ]; then \
		export PATH="$$NVM_DIR/versions/node/v$(NODE_VERSION)/bin:$$PATH"; \
	elif [ -s "$$HOME/.nvm/nvm.sh" ]; then \
		export PATH="$$HOME/.nvm/versions/node/v$(NODE_VERSION)/bin:$$PATH"; \
	fi; \
	./bin/dev

ensure-node-version: ## 🔧 Ensure correct Node.js version before starting
	@printf "$(YELLOW)🔍 Verifying Node.js version...$(RESET)\n"
	@if command -v node >/dev/null 2>&1; then \
		CURRENT_NODE=$$(node -v | sed 's/v//'); \
		if [ "$$(printf '%s\n' "$(NODE_VERSION)" "$$CURRENT_NODE" | sort -V | head -n1)" != "$(NODE_VERSION)" ]; then \
			printf "$(YELLOW)⚠️  Node.js $(NODE_VERSION) required, but $$CURRENT_NODE is active$(RESET)\n"; \
			printf "$(CYAN)🔄 Attempting to switch to Node.js $(NODE_VERSION)...$(RESET)\n"; \
			if [ -s "$$NVM_DIR/nvm.sh" ]; then \
				. "$$NVM_DIR/nvm.sh"; \
				nvm use $(NODE_VERSION) 2>/dev/null || (printf "$(YELLOW)Installing Node.js $(NODE_VERSION)...$(RESET)\n" && nvm install $(NODE_VERSION) && nvm use $(NODE_VERSION)); \
			elif [ -s "$$HOME/.nvm/nvm.sh" ]; then \
				. "$$HOME/.nvm/nvm.sh"; \
				nvm use $(NODE_VERSION) 2>/dev/null || (printf "$(YELLOW)Installing Node.js $(NODE_VERSION)...$(RESET)\n" && nvm install $(NODE_VERSION) && nvm use $(NODE_VERSION)); \
			else \
				printf "$(RED)❌ nvm not found. Please install nvm first:$(RESET)\n"; \
				printf "$(CYAN)   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash$(RESET)\n"; \
				printf "$(CYAN)   source ~/.bashrc  # or ~/.zshrc on macOS$(RESET)\n"; \
				printf "$(CYAN)   Then run: make dev$(RESET)\n"; \
				exit 1; \
			fi; \
			printf "$(GREEN)✅ Node.js version switched to $(NODE_VERSION)$(RESET)\n"; \
		else \
			printf "$(GREEN)✅ Node.js $(NODE_VERSION) is active$(RESET)\n"; \
		fi \
	else \
		printf "$(RED)❌ Node.js is not installed$(RESET)\n"; \
		exit 1; \
	fi

dev-frontend: ## Start only frontend development server
	@echo "$(CYAN)Starting frontend development server...$(RESET)"
	pnpm next dev $(FRONTEND_DIR)

dev-backend: ## Start only backend development server
	@echo "$(CYAN)Starting backend development server...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails server

dev-workers: ## Start Sidekiq workers
	@echo "$(CYAN)Starting Sidekiq workers...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec sidekiq

#########################
# Code Quality
#########################

lint: ## 🧹 Run all linters
	@$(MAKE) lint-js
	@$(MAKE) lint-ruby
	@$(MAKE) lint-css

lint-js: ## 📝 Run JavaScript/TypeScript linters
	@echo "$(CYAN)Running ESLint...$(RESET)"
	pnpm run lint-fast

lint-js-fix: ## Fix JavaScript/TypeScript linting issues
	@echo "$(CYAN)Fixing ESLint issues...$(RESET)"
	pnpm run lint-fast --fix

lint-ruby: ## 💎 Run Ruby linters
	@echo "$(CYAN)Running RuboCop...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rubocop

lint-ruby-fix: ## Fix Ruby linting issues
	@echo "$(CYAN)Fixing RuboCop issues...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rubocop -a

lint-css: ## Run CSS/SCSS linters
	@echo "$(CYAN)Running Prettier on CSS files...$(RESET)"
	pnpm prettier --check "**/*.{css,scss}"

typecheck: ## 🔍 Run TypeScript type checking
	@echo "$(CYAN)Running TypeScript type checking...$(RESET)"
	pnpm typecheck

typecheck-watch: ## Run TypeScript type checking in watch mode
	@echo "$(CYAN)Running TypeScript type checking in watch mode...$(RESET)"
	pnpm typecheck:watch

format: ## Format all code with Prettier
	@echo "$(CYAN)Formatting code with Prettier...$(RESET)"
	pnpm prettier --write .

#########################
# Testing
#########################

test: ## 🧪 Run all tests
	@$(MAKE) test-backend
	@$(MAKE) test-e2e

test-backend: ## 🧪 Run Rails tests
	@echo "$(CYAN)Running Rails tests...$(RESET)"
	cd $(BACKEND_DIR) && RAILS_ENV=test bundle exec rspec

test-backend-watch: ## Run Rails tests in watch mode
	@echo "$(CYAN)Running Rails tests in watch mode...$(RESET)"
	cd $(BACKEND_DIR) && RAILS_ENV=test bundle exec guard

test-e2e: ## 🎭 Run Playwright E2E tests
	@echo "$(CYAN)Running Playwright E2E tests...$(RESET)"
	pnpm exec playwright test

test-e2e-ui: ## Run Playwright tests with UI
	@echo "$(CYAN)Running Playwright tests with UI...$(RESET)"
	pnpm exec playwright test --ui

test-e2e-debug: ## Debug Playwright tests
	@echo "$(CYAN)Debugging Playwright tests...$(RESET)"
	pnpm exec playwright test --debug

#########################
# Database
#########################

db-migrate: ## 🔄 Run database migrations
	@echo "$(CYAN)Running database migrations...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails db:migrate

db-rollback: ## Rollback database migration
	@echo "$(CYAN)Rolling back database migration...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails db:rollback

db-seed: ## Seed the database
	@echo "$(CYAN)Seeding database...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails db:seed

db-reset: ## Reset the database
	@echo "$(CYAN)Resetting database...$(RESET)"
	@echo "$(RED)This will destroy all data! Press Ctrl+C to cancel.$(RESET)"
	@sleep 3
	cd $(BACKEND_DIR) && bundle exec rails db:drop db:create db:migrate db:seed

db-console: ## Open database console
	@echo "$(CYAN)Opening database console...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails dbconsole

#########################
# Rails
#########################

rails-console: ## 💎 Open Rails console
	@echo "$(CYAN)Opening Rails console...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails console

rails-routes: ## Show Rails routes
	@echo "$(CYAN)Rails routes:$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails routes

rails-routes-typescript: ## Generate TypeScript route helpers
	@echo "$(CYAN)Generating TypeScript route helpers...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec rails js:routes:typescript

#########################
# Build
#########################

build: ## 🏗️  Build production assets
	@printf "$(CYAN)🏗️  Building production assets...$(RESET)\n"
	pnpm run build-next

build-analyze: ## Build and analyze bundle size
	@echo "$(CYAN)Building and analyzing bundle...$(RESET)"
	ANALYZE=true pnpm run build-next

#########################
# Git & GitHub
#########################

ghpr: ## 🔀 Create a GitHub pull request using gh CLI
	@printf "$(CYAN)🔀 Creating GitHub pull request...$(RESET)\n"
	@./scripts/create_pr.sh || true

#########################
# Cleanup
#########################

clean-deps: ## Clean dependency caches
	@echo "$(CYAN)Cleaning dependency caches...$(RESET)"
	pnpm store prune
	cd $(BACKEND_DIR) && bundle clean --force

clean-build: ## Clean build artifacts
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
	rm -rf $(FRONTEND_DIR)/.next
	rm -rf $(BACKEND_DIR)/tmp/cache

clean-logs: ## Clean log files
	@echo "$(CYAN)Cleaning log files...$(RESET)"
	rm -f $(BACKEND_DIR)/log/*.log
	touch $(BACKEND_DIR)/log/.keep

clean: clean-build clean-logs ## 🧹 Clean all generated files
	@echo "$(GREEN)✓ Cleanup complete$(RESET)"

#########################
# Utilities
#########################

logs: ## Tail all development logs
	@echo "$(CYAN)Tailing development logs...$(RESET)"
	tail -f $(BACKEND_DIR)/log/development.log

logs-test: ## Tail test logs
	@echo "$(CYAN)Tailing test logs...$(RESET)"
	tail -f $(BACKEND_DIR)/log/test.log

env-check: ## Verify required environment variables
	@echo "$(CYAN)Checking required environment variables...$(RESET)"
	@if [ -f .env ]; then \
		for var in CLERK_SECRET_KEY NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY DATABASE_URL REDIS_URL; do \
			if ! grep -q "^$$var=" .env; then \
				echo "$(YELLOW)⚠ Missing: $$var$(RESET)"; \
			else \
				echo "$(GREEN)✓ Found: $$var$(RESET)"; \
			fi; \
		done; \
	else \
		echo "$(RED)✗ .env file not found$(RESET)"; \
		exit 1; \
	fi

update-deps: ## Update all dependencies
	@echo "$(CYAN)Updating dependencies...$(RESET)"
	@echo "$(YELLOW)Updating Node.js dependencies...$(RESET)"
	pnpm update
	@echo "$(YELLOW)Updating Ruby dependencies...$(RESET)"
	cd $(BACKEND_DIR) && bundle update

#########################
# Docker Helpers
#########################

docker-reset: docker-down ## ♻️  Reset Docker volumes and containers
	@printf "$(CYAN)♻️  Resetting Docker volumes...$(RESET)\n"
	@printf "$(RED)This will destroy all Docker data! Press Ctrl+C to cancel.$(RESET)\n"
	@sleep 3
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) down -v
	@printf "$(GREEN)🎉 Docker reset complete$(RESET)\n"

docker-shell-postgres: ## 🐘 Open PostgreSQL shell
	@printf "$(CYAN)🐘 Opening PostgreSQL shell...$(RESET)\n"
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) exec db psql -U postgres flexile_development

docker-shell-redis: ## 🔴 Open Redis CLI
	@printf "$(CYAN)🔴 Opening Redis CLI...$(RESET)\n"
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) exec redis redis-cli

#########################
# Performance
#########################

analyze-bundle: ## Analyze JavaScript bundle size
	@echo "$(CYAN)Analyzing bundle size...$(RESET)"
	ANALYZE=true pnpm run build-next

lighthouse: ## Run Lighthouse performance audit
	@echo "$(CYAN)Running Lighthouse audit...$(RESET)"
	@if command -v lighthouse >/dev/null 2>&1; then \
		lighthouse https://flexile.dev:8288 --view; \
	else \
		echo "$(RED)✗ Lighthouse is not installed$(RESET)"; \
		echo "$(YELLOW)  Install with: npm install -g lighthouse$(RESET)"; \
		exit 1; \
	fi

#########################
# Security
#########################

security-check: ## 🔐 Run security checks
	@echo "$(CYAN)Running security checks...$(RESET)"
	@echo "$(YELLOW)Checking Node.js dependencies...$(RESET)"
	pnpm audit
	@echo "$(YELLOW)Checking Ruby dependencies...$(RESET)"
	cd $(BACKEND_DIR) && bundle exec bundler-audit check

.PHONY: $(shell grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {print $$1}')