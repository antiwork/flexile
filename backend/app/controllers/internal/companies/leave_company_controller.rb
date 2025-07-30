# frozen_string_literal: true

class Internal::Companies::LeaveCompanyController < Internal::Companies::BaseController
  def destroy
    authorize Current.user, :leave_company?

    result = LeaveCompanyService.new(
      user: Current.user,
      company: Current.company
    ).call

    if result[:success]
      # Clear the selected company cookie since user left this company
      cookie_name = [Current.user.external_id, "selected_company"].join("_")
      cookies.delete(cookie_name)
      render json: { success: true }, status: :ok
    else
      render json: { success: false, error: result[:error] }, status: :unprocessable_entity
    end
  end
end
