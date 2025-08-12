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
      all_users: all_users_props,
    }
  end

  def administrators_props
    admins = @company.company_administrators.includes(:user).order(:id)
    primary_admin = admins.first

    admins.map do |admin|
      user = admin.user
      roles = get_user_roles(user)

      {
        id: user.external_id,
        email: user.email,
        name: user.legal_name || user.preferred_name || user.email,
        isAdmin: true,
        role: primary_admin&.id == admin.id ? "Owner" : "Admin",
        isOwner: primary_admin&.id == admin.id,
        allRoles: roles,
      }
    end.sort_by { |admin| [admin[:isOwner] ? 0 : 1, admin[:name]] }
  end

  def lawyers_props
    @company.company_lawyers.includes(:user).order(:id).map do |lawyer|
      user = lawyer.user
      roles = get_user_roles(user)

      {
        id: user.external_id,
        email: user.email,
        name: user.legal_name || user.preferred_name || user.email,
        isAdmin: roles.include?("Admin"),
        role: "Lawyer",
        isOwner: is_primary_admin?(user),
        allRoles: roles,
      }
    end.sort_by { |lawyer| lawyer[:name] }
  end

  def all_users_props
    seen = Set.new
    all_users = []

    [administrators_props, lawyers_props].each do |role_users|
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
    def get_user_roles(user)
      roles = []

      roles << "Admin" if @company.company_administrators.exists?(user: user)
      roles << "Lawyer" if @company.company_lawyers.exists?(user: user)

      roles
    end

    def is_primary_admin?(user)
      primary_admin = @company.primary_admin
      primary_admin&.user_id == user.id
    end
end
