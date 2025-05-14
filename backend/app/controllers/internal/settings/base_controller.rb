# frozen_string_literal: true

class Internal::Settings::BaseController < Internal::BaseController
  before_action :authenticate_user_json!
end
