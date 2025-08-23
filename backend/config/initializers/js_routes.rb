# frozen_string_literal: true

# Config to make `rails_blob_path`
Rails.application.routes.default_url_options = {
  host: DOMAIN,
  protocol: PROTOCOL,
}

JsRoutes.setup do |config|
  config.module_type = "ESM"
  config.url_links = true
  # Don't determine protocol from window.location (prerendering)
  # Generate URLs pointing to the Rails API host in JS route helpers
  config.default_url_options = { protocol: PROTOCOL, host: API_DOMAIN }
  # effectively turns off js-routes's model parsing
  config.special_options_key = "toString"
  config.exclude = [/^rails_/]
  config.file = Rails.root.join("..", "frontend", "utils", "routes.js").to_s
end
