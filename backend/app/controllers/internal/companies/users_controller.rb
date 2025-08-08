# frozen_string_literal: true

class Internal::Companies::UsersController < Internal::Companies::BaseController
  def index
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)
    render json: presenter.props
  end

  def administrators
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)
    render json: presenter.administrators_props
  end

  def lawyers
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)
    render json: presenter.lawyers_props
  end

  def contractors
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)
    render json: presenter.contractors_props
  end

  def investors
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)
    render json: presenter.investors_props
  end

  def add_role
    authorize CompanyAdministrator

    result = AddUserRoleService.new(
      company: Current.company,
      user_id: params[:user_id],
      role: params[:role]
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
      user_id: params[:user_id],
      role: params[:role],
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
