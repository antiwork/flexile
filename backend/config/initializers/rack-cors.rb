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
    origins ["#{PROTOCOL}://#{ROOT_DOMAIN}", "http://localhost:3001", "http://127.0.0.1:3001"]
    resource "*", headers: :any, methods: [:get, :post, :put, :delete]
  end
end
