# frozen_string_literal: true

class Api::BaseController < ActionController::Base
  include JwtAuthenticatable, ApiTokenAuthenticatable

  protect_from_forgery with: :null_session
  before_action :set_paper_trail_whodunnit

  private
    def set_paper_trail_whodunnit
      PaperTrail.request.whodunnit = Current.user&.id
    end

    def e404
      raise ActionController::RoutingError, "Not Found"
    end

    def e401_json
      render json: { success: false, error: "Unauthorized" }, status: :unauthorized
    end
end
