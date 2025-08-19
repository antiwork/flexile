# frozen_string_literal: true

class AddUserRoleService
  ALLOWED_ROLES = {
    "admin" => :add_admin_role,
    "lawyer" => :add_lawyer_role,
  }.freeze

  def initialize(company:, user_id:, role:)
    @company = company
    @user_external_id = user_id
    @role = role
  end

  def perform
    user = User.find_by(external_id: @user_external_id)
    return { success: false, error: "User not found" } unless user

    handler = ALLOWED_ROLES[@role.to_s.downcase]
    return { success: false, error: "Invalid role. Must be one of: #{ALLOWED_ROLES.keys.join(', ')}" } unless handler
    send(handler, user)
  end

  private
    def add_admin_role(user)
      existing_admin = @company.company_administrators.find_by(user: user)
      return { success: false, error: "User is already an administrator" } if existing_admin

      @company.company_administrators.create!(user: user)
      { success: true }
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error: e.record.errors.full_messages.to_sentence }
    end

    def add_lawyer_role(user)
      existing_lawyer = @company.company_lawyers.find_by(user: user)
      return { success: false, error: "User is already a lawyer" } if existing_lawyer

      @company.company_lawyers.create!(user: user)
      { success: true }
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error: e.record.errors.full_messages.to_sentence }
    end
end
