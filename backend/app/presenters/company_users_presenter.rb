# frozen_string_literal: true

require "set"

class CompanyUsersPresenter
  ALLOWED_USER_TYPES = {
    "administrators" => :administrators_props,
    "lawyers" => :lawyers_props,
    "contractors" => :contractors_props,
    "investors" => :investors_props,
  }.freeze

  DEFAULT_USER_TYPES = ALLOWED_USER_TYPES.keys.freeze

  def initialize(company:)
    @company = company
  end

  def users(filters = DEFAULT_USER_TYPES)
    requested_types =
      case filters
      when Array
        filters
      when String
        filters.strip.empty? ? DEFAULT_USER_TYPES : filters.split(",").map(&:strip)
      else
        DEFAULT_USER_TYPES
      end

    allowed_types = requested_types & ALLOWED_USER_TYPES.keys

    allowed_types
      .flat_map { |type| send(ALLOWED_USER_TYPES[type]) }
      .uniq { |user| user[:id] }
  end

  private
    def administrators_props
      admins = @company.company_administrators.includes(:user).order(:id)

      admins.map do |admin|
        user = admin.user

        user_props(user).merge(
          role: is_primary_admin?(user) ? "Owner" : format_role_display(get_user_roles(user)),
        )
      end.sort_by { |admin| [admin[:isOwner] ? 0 : 1, admin[:name]] }
    end

    def lawyers_props
      @company.company_lawyers.includes(:user).order(:id).map do |lawyer|
        user = lawyer.user

        user_props(user).merge(
          role: "Lawyer",
        )
      end.sort_by { |lawyer| lawyer[:name] }
    end

    def contractors_props
      @company.company_workers.includes(:user).order(:id).map do |worker|
        user = worker.user

        user_props(user).merge(
          role: "Contractor",
          active: worker.active?,
        )
      end.sort_by { |contractor| contractor[:name] }
    end

    def investors_props
      @company.company_investors.includes(:user).order(:id).map do |investor|
        user = investor.user

        user_props(user).merge(
          role: "Investor",
        )
      end.sort_by { |investor| investor[:name] }
    end

  private
    def user_props(user)
      roles = get_user_roles(user)

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

    def format_role_display(roles)
      sorted_roles = roles.sort_by { |role| role == "Admin" ? 0 : 1 }
      sorted_roles.join(", ")
    end
end
