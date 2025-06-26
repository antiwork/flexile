# frozen_string_literal: true

class Internal::Companies::InviteLinksController < Internal::BaseController
  def accept
    result = AcceptCompanyInviteLink.new(token: params[:token], user: Current.user).perform

    if result[:success]
      render json: { success: true, company_worker_id: result[:company_worker].id }, status: :ok
    else
      render json: { success: false, error: result[:error] }, status: :unprocessable_entity
    end
  end

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
end
