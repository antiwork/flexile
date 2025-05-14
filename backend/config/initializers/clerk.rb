# frozen_string_literal: true

Clerk.configure do |c|
  c.secret_key = GlobalConfig.get("CLERK_SECRET_KEY", "sk_test_dummy_key_for_test_environment")
  c.excluded_routes = ["/webhooks/*", "/rails/*", "/assets/*"]
end
