# frozen_string_literal: true

class ApplicationController < ActionController::Base
  include PunditAuthorization, SetCurrent
  before_action :set_paper_trail_whodunnit

  after_action :set_csrf_cookie


  private
    def authenticate_user_json!
      e401_json if Current.user.nil?
    end

    def e404
      raise ActionController::RoutingError, "Not Found"
    end

    def e401_json
      render json: { success: false, error: "Unauthorized" }, status: :unauthorized
    end

    def json_redirect(path, error: nil)
      render json: { redirect_path: path }.merge(error:).compact, status: :forbidden
    end

    def info_for_paper_trail
      {
        remote_ip: request.remote_ip,
        request_path: request.path,
        request_uuid: request.uuid,
      }
    end

    def set_csrf_cookie
      cookie_options = {
        value: form_authenticity_token,
      }

      # Only apply strict cookie options in staging and production environments.
      # In development, omitting domain and secure options avoids issues with local cookies being rejected by the browser.
      if Rails.env.staging? || Rails.env.production?
        cookie_options.merge!(
          same_site: :strict,
          secure: true,
          domain: DOMAIN
        )
      end

      cookies["X-CSRF-Token"] = cookie_options
    end

    def user_for_paper_trail
      Current.user&.id
    end
end
