# frozen_string_literal: true

class Internal::Companies::InviteLinksController < Internal::BaseController
  skip_before_action :force_onboarding

  def show
    authorize CompanyAdministrator

    document_template_id = params[:document_template_id] || nil
    invite_link = CompanyInviteLink.find_or_create_by(company: Current.company, inviter: Current.user, document_template_id:)
    if invite_link.persisted?
      render json: { success: true, invite_link: invite_link.token }, status: :ok
    else
      render json: { success: false, error: invite_link.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def reset
    authorize CompanyAdministrator

    document_template_id = params[:document_template_id] || nil
    invite_link = CompanyInviteLink.find_by(company: Current.company, inviter: Current.user, document_template_id:)
    if invite_link
      invite_link.reset!
      render json: { success: true, invite_link: invite_link.token }, status: :ok
    else
      render json: { success: false, error: "Invite link not found" }, status: :not_found
    end
  end

  def complete_onboarding
    update_params = params_for_update
    result = CompleteInviteLinkOnboarding.new(user: Current.user, company: Current.company, update_params:).process
    if result[:success]
      render json: { success: true, document_id: result[:document]&.id,  template_id: result[:template_id] }, status: :ok
    else
      render json: { success: false, error_message: error_message }, status: :unprocessable_entity
    end
  end

  def params_for_update
    params.permit(:started_at, :role, :pay_rate_type, :pay_rate_in_subunits, :hours_per_week)
  end
end
