# frozen_string_literal: true

class Internal::Companies::BaseController < Internal::BaseController
  before_action :authenticate_user_json!
  after_action :verify_authorized
end
