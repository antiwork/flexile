# frozen_string_literal: true

class Internal::Companies::AdministratorsController < Internal::Companies::BaseController
  def create
    authorize CompanyAdministrator

    result = InviteAdmin.new(company: Current.company, email: params[:email], current_user: Current.user).perform

    if result[:success]
      head :created
    else
      render json: { success: false, field: result[:field], error_message: result[:error_message] }, status: :unprocessable_entity
    end
  end
end
