# frozen_string_literal: true

class Internal::InviteLinksController < ApplicationController
  skip_before_action :force_onboarding
  skip_before_action :verify_authenticity_token, only: [:verify]
  skip_before_action :authenticate_user_json!, only: [:verify]

  before_action :skip_step, if: -> { Current.user.company_worker_for?(Current.company) }, only: [:accept]

  before_action :require_token!

  def verify
    invite_link = CompanyInviteLink.find_by(token: params[:token])

    if invite_link
      render json: {
        valid: true,
        inviter_name: invite_link.inviter.display_name,
        company_name: invite_link.company.display_name,
        company_id: invite_link.company.external_id,
      }
    else
      render json: { valid: false, error: "Invalid token" }, status: :not_found
    end
  end

  def accept
    result = AcceptCompanyInviteLink.new(token: params[:token], user: Current.user).perform

    if result[:success]
      render json: { success: true, company_worker_id: result[:company_worker].id }, status: :ok
    else
      render json: { success: false, error: result[:error] }, status: :unprocessable_entity
    end
  end

  private
    def require_token!
      if params[:token].blank?
        render json: { valid: false, error: "'token' is required" }, status: :bad_request
      end
    end

    def skip_step
      json_redirect(onboarding_service.redirect_path || onboarding_service.after_complete_onboarding_path)
    end

    def onboarding_service
      OnboardingState::Worker.new(user: Current.user, company: Current.company)
    end
end
