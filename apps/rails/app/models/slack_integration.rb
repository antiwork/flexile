# frozen_string_literal: true

class SlackIntegration < Integration
  store_accessor :configuration, :team_id, :bot_user_id, :access_token
end
