# frozen_string_literal: true

class Internal::SettingsController < Internal::Settings::BaseController
  after_action :verify_authorized

  def update
    authorize :user

    settings_params = params.require(:settings).permit(:email, :preferred_name)

    error_message = UpdateUser.new(
      user: Current.user,
      update_params: settings_params
    ).process

    if error_message.nil?
      head :no_content
    else
      render json: { error_message: }, status: :unprocessable_entity
    end
  end
end
