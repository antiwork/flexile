# frozen_string_literal: true

# Allow requests from all origins to API domain
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "*"
    resource "*",
             headers: :any,
             methods: [:get, :post, :put, :delete],
             if: proc { |env| API_DOMAIN == env["HTTP_HOST"] }
  end
  allow do
    origins "https://#{ROOT_DOMAIN}"
    resource "*", headers: :any, methods: [:get]
  end
end
