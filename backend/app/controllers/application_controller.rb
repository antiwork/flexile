# frozen_string_literal: true

require "clerk/authenticatable"

class ApplicationController < ActionController::Base
  include Clerk::Authenticatable
  include PunditAuthorization, SetCurrent

  before_action :force_onboarding, if: -> { clerk.user? }, except: [:userid, :current_user_data]
  before_action :set_paper_trail_whodunnit
  before_action :authenticate_user_json!, only: [:userid]

  after_action :set_csrf_cookie

  def userid
    render json: { id: Current.user.id }
  end

  def current_user_data
    return e401_json if Current.user.nil?
    render json: UserPresenter.new(current_context:).logged_in_user
  end

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

    def force_onboarding
      redirect_path = OnboardingState::User.new(user: Current.user, company: Current.company).redirect_path

      respond_to do |format|
        format.html  { redirect_to redirect_path }
        format.json  { render(json: { success: false, redirect_path: }, status: :forbidden) }
      end if redirect_path
    end

    def set_csrf_cookie
      cookies["X-CSRF-Token"] = {
        value: form_authenticity_token,
        secure: true,
        same_site: :strict,
        domain: DOMAIN,
      }
    end

    def user_for_paper_trail
      Current.user&.id
    end
end
