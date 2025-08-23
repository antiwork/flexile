# frozen_string_literal: true

# Simple configuration that relies on environment variables being set appropriately for each environment
PROTOCOL = Rails.env.development? ? "http" : "https"
ROOT_DOMAIN = ENV.fetch("DOMAIN", Rails.env.development? ? "localhost:3001" : nil)
DOMAIN = ENV.fetch("APP_DOMAIN", ROOT_DOMAIN)
API_DOMAIN = ENV.fetch("API_DOMAIN", Rails.env.development? ? "localhost:3000" : ROOT_DOMAIN)
