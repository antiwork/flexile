# frozen_string_literal: true

class Internal::Companies::InviteLinksController < Internal::BaseController
  def show
    authorize CompanyAdministrator

    document_template_id = params[:document_template_id] || nil
    invite_link = CompanyInviteLink.find_or_create_by(company: Current.company, document_template_id:)
    if invite_link.persisted?
      render json: { success: true, invite_link: invite_link.token }, status: :ok
    else
      render json: { success: false, error: invite_link.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def reset
    authorize CompanyAdministrator

    document_template_id = params[:document_template_id] || nil
    invite_link = CompanyInviteLink.find_by(company: Current.company, document_template_id:)
    if invite_link
      invite_link.reset!
      render json: { success: true, invite_link: invite_link.token }, status: :ok
    else
      render json: { success: false, error: "Invite link not found" }, status: :not_found
    end
  end
end
