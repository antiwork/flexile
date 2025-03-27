# frozen_string_literal: true

configuration_by_env = {
  production: {
    protocol: "https",
    root_domain: ENV.fetch("ROOT_DOMAIN", "flexile.com"),
    domain: ENV.fetch("APP_DOMAIN", "app.flexile.com"),
    api_domain: ENV.fetch("API_DOMAIN", "api.flexile.com"),
    email_domain: ENV.fetch("EMAIL_DOMAIN", "flexile.com"),
  },
  staging: {
    protocol: "https",
    root_domain: ENV.fetch("STAGING_ROOT_DOMAIN", "demo.flexile.com"),
    domain: ENV.fetch("STAGING_APP_DOMAIN", "demo.flexile.com"),
    api_domain: ENV.fetch("STAGING_API_DOMAIN", "api.demo.flexile.com"),
    email_domain: ENV.fetch("STAGING_EMAIL_DOMAIN", "demo.flexile.com"),
  },
  test: {
    protocol: "https",
    root_domain: ENV.fetch("TEST_ROOT_DOMAIN", "test.flexile.dev"),
    domain: ENV.fetch("TEST_APP_DOMAIN", "test.flexile.dev"),
    api_domain: ENV.fetch("TEST_API_DOMAIN", "api.test.flexile.dev"),
    email_domain: ENV.fetch("TEST_EMAIL_DOMAIN", "test.flexile.dev"),
  },
  development: {
    protocol: "https",
    root_domain: ENV.fetch("DEV_ROOT_DOMAIN", "flexile.dev"),
    domain: ENV.fetch("DEV_APP_DOMAIN", "flexile.dev"),
    api_domain: ENV.fetch("DEV_API_DOMAIN", "api.flexile.dev"),
    email_domain: ENV.fetch("DEV_EMAIL_DOMAIN", "flexile.dev"),
  },
}

config = configuration_by_env[Rails.env.to_sym]

if Rails.env.development? && ENV["LOCAL_PROXY_DOMAIN"].present?
  ROOT_DOMAIN = ENV["LOCAL_PROXY_DOMAIN"]
  DOMAIN = ENV["LOCAL_PROXY_DOMAIN"]
  API_DOMAIN = ENV["LOCAL_PROXY_DOMAIN"]
  EMAIL_DOMAIN = configuration_by_env[:development][:email_domain]
else
  ROOT_DOMAIN = config[:root_domain]
  DOMAIN = config[:domain]
  API_DOMAIN = config[:api_domain]
  EMAIL_DOMAIN = config[:email_domain]
end

PROTOCOL = config[:protocol]
