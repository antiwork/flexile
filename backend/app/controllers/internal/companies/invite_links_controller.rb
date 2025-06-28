# frozen_string_literal: true

class Internal::Companies::InviteLinksController < Internal::BaseController
  skip_before_action :force_onboarding

  def show
    authorize CompanyWorker

    invite_link = CompanyInviteLink.find_or_create_by(company: Current.company, inviter: Current.user)
    if invite_link.persisted?
      render json: { success: true, invite_link: invite_link.token }, status: :ok
    else
      render json: { success: false, error: invite_link.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def reset
    authorize CompanyWorker, :update?

    invite_link = CompanyInviteLink.find_by(company: Current.company, inviter: Current.user)
    if invite_link
      CompanyInviteLink.reset_for(invite_link)
      render json: { success: true, invite_link: invite_link.token }, status: :ok
    else
      render json: { success: false, error: "Invite link not found" }, status: :not_found
    end
  end

  def complete_onboarding
    update_params = params_for_update
    error_message = CompleteInviteLinkOnboarding.new(user: Current.user, company: Current.company, update_params:).process
    if error_message.blank?
      render json: { success: true }
    else
      render json: { success: false, error_message: error_message }, status: :unprocessable_entity
    end
  end

  def params_for_update
    params.permit(:started_at, :role, :pay_rate_type, :pay_rate_in_subunits, :hours_per_week)
  end

  def enforce_all_values_for_update
    all_values_present = params_for_update.to_h.values.all?(&:present?)
    unless all_values_present
      render json: { success: false, error_message: "Please input all values" }
    end
  end
end
