class Internal::Companies::ContractorInviteLinkController < Internal::Companies::BaseController
  def show
    authorize ContractorInviteLink

    invite_link = Current.company.contractor_invite_links.find_by(user: Current.user)

    if invite_link.nil?
      invite_link = Current.company.contractor_invite_links.create!(
        user: Current.user
      )
    end

    frontend_base_url = request.headers['X-Frontend-Host'] || "#{request.protocol}#{request.host_with_port}"

    render json: {
      id: invite_link.external_id,
      uuid: invite_link.uuid,
      url: invite_link.url(frontend_base_url),
      created_at: invite_link.created_at,
      user_id: invite_link.user.external_id,
      company_id: invite_link.company.external_id
    }
  end

  def reset
    authorize ContractorInviteLink

    invite_link = Current.company.contractor_invite_links.find_by!(user: Current.user)
    invite_link.update!(uuid: SecureRandom.alphanumeric(14))

    frontend_base_url = request.headers['X-Frontend-Host'] || "#{request.protocol}#{request.host_with_port}"

    render json: {
      id: invite_link.external_id,
      uuid: invite_link.uuid,
      url: invite_link.url(frontend_base_url),
      created_at: invite_link.created_at,
      user_id: invite_link.user.external_id,
      company_id: invite_link.company.external_id
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invite link not found" }, status: :not_found
  end
end