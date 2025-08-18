# frozen_string_literal: true

require "set"

class CompanyUsersPresenter
  def initialize(company:)
    @company = company
  end

  def props
    {
      administrators: administrators_props,
      lawyers: lawyers_props,
      contractors: contractors_props,
      investors: investors_props,
      all_users: all_users_props,
    }
  end

  def filtered_users(filters)
    return props if filters.blank?

    valid_filters = %w[administrators lawyers contractors investors]
    applied_filters = filters & valid_filters

    return props if applied_filters.empty?

    combined_users = []
    applied_filters.each do |filter|
      case filter
      when "administrators"
        combined_users.concat(administrators_props)
      when "lawyers"
        combined_users.concat(lawyers_props)
      when "contractors"
        combined_users.concat(contractors_props)
      when "investors"
        combined_users.concat(investors_props)
      end
    end

    # Remove duplicates based on user ID and return unique users
    combined_users.uniq { |user| user[:id] }
  end

  def administrators_props
    admins = @company.company_administrators.includes(:user).order(:id)

    admins.map do |admin|
      user = admin.user
      roles = get_user_roles(user)

      user_props(user, roles).merge(
        role: is_primary_admin?(user) ? "Owner" : "Admin",
      )
    end.sort_by { |admin| [admin[:isOwner] ? 0 : 1, admin[:name]] }
  end

  def lawyers_props
    @company.company_lawyers.includes(:user).order(:id).map do |lawyer|
      user = lawyer.user
      roles = get_user_roles(user)

      user_props(user, roles).merge(
        role: "Lawyer",
      )
    end.sort_by { |lawyer| lawyer[:name] }
  end

  def contractors_props
    @company.company_workers.includes(:user).order(:id).map do |worker|
      user = worker.user
      roles = get_user_roles(user)

      user_props(user, roles).merge(
        role: "Contractor",
        active: worker.active?,
      )
    end.sort_by { |contractor| contractor[:name] }
  end

  def investors_props
    @company.company_investors.includes(:user).order(:id).map do |investor|
      user = investor.user
      roles = get_user_roles(user)

      user_props(user, roles).merge(
        role: "Investor",
      )
    end.sort_by { |investor| investor[:name] }
  end

  def all_users_props
    seen = Set.new
    all_users = []

    [administrators_props, lawyers_props, contractors_props, investors_props].each do |role_users|
      role_users.each do |user|
        next if seen.include?(user[:id])
        seen.add(user[:id])
        all_users << {
          id: user[:id],
          email: user[:email],
          name: user[:name],
          allRoles: user[:allRoles],
        }
      end
    end

    all_users.sort_by { |user| user[:name] }
  end

  private
    # Common method for user properties that are shared across all role types
    def user_props(user, roles)
      {
        id: user.external_id,
        email: user.email,
        name: user.legal_name || user.preferred_name || user.email,
        allRoles: roles,
        isOwner: is_primary_admin?(user),
        isAdmin: roles.include?("Admin"),
      }
    end

    def get_user_roles(user)
      roles = []

      roles << "Admin" if @company.company_administrators.exists?(user: user)
      roles << "Lawyer" if @company.company_lawyers.exists?(user: user)
      roles << "Contractor" if @company.company_workers.exists?(user: user)
      roles << "Investor" if @company.company_investors.exists?(user: user)

      roles
    end

    def is_primary_admin?(user)
      primary_admin = @company.primary_admin
      primary_admin&.user_id == user.id
    end
end
