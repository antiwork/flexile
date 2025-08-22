# frozen_string_literal: true

class Internal::InviteLinksController < Internal::BaseController
  before_action :authenticate_user_json!

  def accept
    result = AcceptCompanyInviteLink.new(token: params[:token], user: Current.user).perform
    cookies.delete("invitation_token")

    if result[:success]
      cookies.permanent[current_user_selected_company_cookie_name] = result[:company].external_id

      if result[:self_invite]
        render json: { self_invite: true }
      else
        head :no_content
      end
    else
      render json: { error_message: result[:error] }, status: :unprocessable_entity
    end
  end
end
