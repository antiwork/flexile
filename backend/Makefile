# ===================================================
# Flexile Backend Test Makefile
# ===================================================
# Simple commands for running tests with API mocks
# No real credentials required!
#
# Usage:
#   make test         # Run all tests with mocks
#   make test-models  # Run model tests only
#   make help         # Show all commands
# ===================================================

# Default database connection for tests
DB_URL ?= postgresql://$(USER)@127.0.0.1:5432/flexile_test

# Required environment variables for tests
TEST_ENV = RAILS_ENV=test \
           DATABASE_URL="$(DB_URL)" \
           USE_STRIPE_MOCK=true \
           USE_WISE_MOCK=true \
           WISE_PROFILE_ID=local_test \
           WISE_API_KEY=local_test \
           ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=dummy_primary_key_please_change \
           ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=dummy_deterministic_key_please_change \
           ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=dummy_key_derivation_salt \
           SECRET_KEY_BASE=dummy_secret_key_base_for_tests

# Colors for better output
BLUE := \033[1;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

.PHONY: help test test-models test-services test-controllers test-stripe test-wise \
        test-frontend test-payments test-e2e-api \
        verify-mocks clean

# Default target
help:
	@echo ""
	@echo "${BLUE}Flexile Backend Test Commands${NC}"
	@echo "========================================"
	@echo "${GREEN}make test${NC}           Run all tests with API mocks"
	@echo "${GREEN}make test-models${NC}    Run model tests only"
	@echo "${GREEN}make test-services${NC}  Run service tests only"
	@echo "${GREEN}make test-controllers${NC} Run controller tests only"
	@echo "${GREEN}make test-stripe${NC}    Run Stripe-specific tests"
	@echo "${GREEN}make test-wise${NC}      Run Wise-specific tests"
	@echo "${GREEN}make test-frontend${NC}  Run ALL frontend Jest tests"
	@echo "${GREEN}make test-payments${NC}  Run payment-flow Jest tests only"
	@echo "${GREEN}make test-e2e-api${NC}   Run Playwright API E2E tests (skip user journeys)"
	@echo ""
	@echo "${YELLOW}E2E Browser Options:${NC}"
	@echo "  PLAYWRIGHT_HEADLESS=false make test-e2e-api  # Run E2E tests with visible browser windows"
	@echo "${GREEN}make verify-mocks${NC}   Verify mock configuration"
	@echo "${GREEN}make clean${NC}          Stop stripe-mock server"
	@echo ""
	@echo "${YELLOW}Run a specific test:${NC}"
	@echo "  make test SPEC=path/to/spec.rb"
	@echo ""

# Run all tests with mocks
test:
ifdef SPEC
	@echo "Running specific test: ${SPEC}"
	@${TEST_ENV} bundle exec rake "test:with_mocks[${SPEC}]"
else
	@echo "Running all tests with mocks..."
	@${TEST_ENV} bundle exec rake test:with_mocks
endif

# Run model tests only
test-models:
	@echo "Running model tests with mocks..."
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/models]"

# Run service tests only
test-services:
	@echo "Running service tests with mocks..."
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/services]"

# Run controller tests only
test-controllers:
	@echo "Running controller tests with mocks..."
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/controllers]"

# Run Stripe-specific tests
test-stripe:
	@echo "Running Stripe-specific tests with mocks..."
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/models/company_stripe_account_spec.rb]"
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/services/stripe]"

# Run Wise-specific tests
test-wise:
	@echo "Running Wise-specific tests with mocks..."
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/models/wise_recipient_spec.rb]"
	@${TEST_ENV} bundle exec rake "test:with_mocks[spec/models/wise_credential_spec.rb]"

# ------------------------------------------------------------------
# Front-end testing helpers (Jest + Playwright)
# ------------------------------------------------------------------

# Run all frontend Jest tests (MSW is auto-started via jest.setup.js)
test-frontend:
	@echo "Running ALL frontend Jest tests..."
	@cd .. && pnpm test

# Run payment-specific Jest tests (pattern = payment)
test-payments:
	@echo "Running frontend payment-flow Jest tests..."
	@cd .. && pnpm run test:payment

# Run Playwright E2E API-only tests (grep \"@api\", skips full user journeys)
test-e2e-api:
	@echo "Running Playwright E2E API tests (skip user journeys)..."
	@cd .. && PLAYWRIGHT_HEADLESS=true pnpm playwright test --grep "@api"

# Verify mock configuration
verify-mocks:
	@echo "Verifying mock configuration..."
	@${TEST_ENV} bundle exec rake test:verify_mocks

# Clean up resources
clean:
	@echo "Stopping stripe-mock server if running..."
	@-pkill -f "stripe-mock" || true
	@echo "Done!"
