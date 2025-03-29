# frozen_string_literal: true

# Simple configuration that relies on environment variables being set appropriately for each environment
PROTOCOL = "https"
ROOT_DOMAIN = ENV.fetch("DOMAIN", "flexile.com")
DOMAIN = ENV.fetch("APP_DOMAIN", "app.flexile.com")
API_DOMAIN = ENV.fetch("API_DOMAIN", "api.flexile.com")
EMAIL_DOMAIN = ENV.fetch("EMAIL_DOMAIN", "flexile.com")
