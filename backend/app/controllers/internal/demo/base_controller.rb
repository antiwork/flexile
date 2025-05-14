# frozen_string_literal: true

class Internal::Demo::BaseController < Internal::BaseController
  before_action :ensure_valid_environment!

  private
    def ensure_valid_environment!
      e404 if Rails.env.production?
    end
end
