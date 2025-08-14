# frozen_string_literal: true

class Internal::InviteLinksController < ApplicationController
  before_action :authenticate_user_json!

  def accept
    result = AcceptCompanyInviteLink.new(token: params[:token], user: Current.user).perform
    cookies.delete("invitation_token")

    if result[:success]
      cookies.permanent[current_user_selected_company_cookie_name] = result[:company].external_id
      head :no_content
    else
      render json: { error_message: result[:error] }, status: :unprocessable_entity
    end
  end
end
