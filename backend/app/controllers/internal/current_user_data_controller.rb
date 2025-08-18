# frozen_string_literal: true

class Internal::CurrentUserDataController < Internal::BaseController
  def show
    return e401_json if Current.user.nil?
    render json: UserPresenter.new(current_context:).logged_in_user
  end

  private
    def e401_json
      render json: { success: false, error: "Unauthorized" }, status: :unauthorized
    end
end
