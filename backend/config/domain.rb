# frozen_string_literal: true

# Simple configuration that relies on environment variables being set appropriately for each environment

ENVIRONMENT = ENV.fetch("RAILS_ENV", "development")

configuration_by_environment = {
  "development" => {
    protocol: "http",
    root_domain: "localhost",
    domain: "localhost",
    api_domain: "localhost",
  },
  "production" => {
    protocol: "https",
    root_domain: "flexile.com",
    domain: "flexile.com",
    api_domain: "api.flexile.com",
  },
}

PROTOCOL = configuration_by_environment[ENVIRONMENT][:protocol] || "https"
ROOT_DOMAIN = ENV.fetch("DOMAIN") || configuration_by_environment[ENVIRONMENT][:root_domain]
DOMAIN = ENV.fetch("APP_DOMAIN", ROOT_DOMAIN) || configuration_by_environment[ENVIRONMENT][:domain]
API_DOMAIN = ENV.fetch("API_DOMAIN", ROOT_DOMAIN) || configuration_by_environment[ENVIRONMENT][:api_domain]
