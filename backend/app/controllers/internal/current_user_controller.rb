# frozen_string_literal: true

class Internal::CurrentUserController < Internal::BaseController
  before_action :authenticate_user_json!

  def show
    render json: UserPresenter.new(current_context:).logged_in_user
  end
end
