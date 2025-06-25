class Public::ContractorInviteLinksController < ApplicationController
  def show
    invite_link = ContractorInviteLink.find_by!(uuid: params[:uuid])
    
    render json: {
      id: invite_link.external_id,
      uuid: invite_link.uuid,
      company: {
        id: invite_link.company.external_id,
        name: invite_link.company.display_name,
        logo_url: invite_link.company.logo_url
      },
      user: {
        id: invite_link.user.external_id,
        display_name: invite_link.user.display_name
      }
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invite link not found" }, status: :not_found
  end
end