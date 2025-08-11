# frozen_string_literal: true

class Internal::Companies::UsersController < Internal::Companies::BaseController
  def index
    authorize CompanyAdministrator

    presenter = CompanyUsersPresenter.new(company: Current.company)

    if params[:filter].present?
      filters = params[:filter].split(",").map(&:strip)
      valid_filters = %w[administrators lawyers contractors investors]
      applied_filters = filters & valid_filters

      if applied_filters.any?
        combined_users = []

        applied_filters.each do |filter|
          case filter
          when "administrators"
            combined_users.concat(presenter.administrators_props)
          when "lawyers"
            combined_users.concat(presenter.lawyers_props)
          when "contractors"
            combined_users.concat(presenter.contractors_props)
          when "investors"
            combined_users.concat(presenter.investors_props)
          end
        end

        # Remove duplicates based on user ID and sort by role priority then name
        unique_users = combined_users.uniq { |user| user[:id] }.sort_by do |user|
          [
            user[:isOwner] ? 0 : 1,  # Owner first
            user[:role] == "Owner" ? 0 : 1,  # Owner role first
            user[:role] == "Admin" ? 0 : 1,  # Admin role second
            user[:role] == "Lawyer" ? 0 : 1, # Lawyer role third
            user[:name]  # Then by name
          ]
        end
        render json: unique_users
      else
        # No valid filters, return all users
        render json: presenter.props
      end
    else
      render json: presenter.props
    end
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
