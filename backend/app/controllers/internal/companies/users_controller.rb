# frozen_string_literal: true

class Internal::Companies::UsersController < Internal::Companies::BaseController
  def index
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)
    render json: presenter.users(params[:filter])
  end

  def add_role
    authorize CompanyAdministrator

    result = AddUserRoleService.new(
      company: Current.company,
      user_id: user_params[:user_id],
      role: user_params[:role]
    ).perform

    if result[:success]
      head :ok
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  end

  def remove_role
    authorize CompanyAdministrator

    result = RemoveUserRoleService.new(
      company: Current.company,
      user_id: user_params[:user_id],
      role: user_params[:role],
      current_user: Current.user
    ).perform

    if result[:success]
      head :ok
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  end

  private
    def user_params
      params.permit(:user_id, :role)
    end
end
