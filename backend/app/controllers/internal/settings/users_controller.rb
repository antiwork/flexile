# frozen_string_literal: true

class Internal::Settings::UsersController < Internal::Settings::BaseController
  after_action :verify_authorized

  def update
    authorize :user

    error_message = UpdateUser.new(
      user: Current.user,
      update_params: update_params
    ).process

    if error_message.nil?
      render json: { success: true }
    else
      render json: { error_message: }, status: :unprocessable_entity
    end
  end

  private
    def update_params
      params.permit(
        :email,
        :preferred_name
      )
    end
end
