# frozen_string_literal: true

class Internal::Companies::SwitchController < Internal::Companies::BaseController
  def create
    skip_authorization

    render json: UserPresenter.new(current_context: pundit_user).logged_in_user
  end
end
