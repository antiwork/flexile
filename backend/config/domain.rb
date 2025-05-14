# frozen_string_literal: true

# Simple configuration that relies on environment variables being set appropriately for each environment
PROTOCOL = "https"
ROOT_DOMAIN = ENV.fetch("DOMAIN")
DOMAIN = ENV.fetch("APP_DOMAIN", ROOT_DOMAIN)
API_DOMAIN = ENV.fetch("API_DOMAIN", ROOT_DOMAIN)
