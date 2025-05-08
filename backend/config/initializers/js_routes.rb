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
  config.default_url_options = { protocol: PROTOCOL, host: DOMAIN }
  # effectively turns off js-routes's model parsing
  config.special_options_key = "toString"
  config.exclude = [/^rails_/]
  config.file = Rails.root.join("..", "next", "utils", "routes.js").to_s
end
