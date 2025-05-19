# frozen_string_literal: true

Flipper.configure do |config|
  config.adapter { Flipper::Adapters::Redis.new(Redis.new(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })) }
end

Flipper.register(:team_member) do |actor|
  actor.respond_to?(:team_member?) && actor.team_member?
end

Flipper::UI.configure do |config|
  config.fun = false
end
