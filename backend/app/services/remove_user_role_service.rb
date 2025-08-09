# frozen_string_literal: true

class RemoveUserRoleService
  ALLOWED_ROLES = {
    "admin" => :remove_admin_role,
    "lawyer" => :remove_lawyer_role,
    "contractor" => :remove_contractor_role,
    "investor" => :remove_investor_role,
  }.freeze

  def initialize(company:, user_id:, role:, current_user:)
    @company = company
    @user_id = user_id
    @role = role
    @current_user = current_user
  end

  def perform
    user = User.find_by(external_id: @user_id)
    return { success: false, error: "User not found" } unless user

    handler = ALLOWED_ROLES[@role.to_s.downcase]
    return { success: false, error: "Invalid role. Must be one of: #{ALLOWED_ROLES.keys.join(', ')}" } unless handler
    @company.transaction do
      send(handler, user)
    end
  rescue StandardError => e
    { success: false, error: e.message }
  end

  private
    def remove_admin_role(user)
      # Prevent removing the last administrator first
      admin_count = @company.company_administrators.count
      if admin_count == 1 && @company.company_administrators.exists?(user: user)
        return { success: false, error: "Cannot remove the last administrator" }
      end

      # Prevent removing own admin role
      acting_user = @current_user || Current.user
      if acting_user&.id == user.id
        return { success: false, error: "You cannot remove your own admin role" }
      end

      admin = @company.company_administrators.find_by(user: user)
      return { success: false, error: "User is not an administrator" } unless admin

      admin.destroy!
      { success: true }
    end

    def remove_lawyer_role(user)
      lawyer = @company.company_lawyers.find_by(user: user)
      return { success: false, error: "User is not a lawyer" } unless lawyer

      lawyer.destroy!
      { success: true }
    end

    def remove_contractor_role(user)
      contractor = @company.company_workers.find_by(user: user)
      return { success: false, error: "User is not a contractor" } unless contractor

      # For contractors, we set ended_at instead of deleting to preserve history
      contractor.update!(ended_at: Time.current)
      { success: true }
    end

    def remove_investor_role(user)
      investor = @company.company_investors.find_by(user: user)
      return { success: false, error: "User is not an investor" } unless investor

      # Check if investor has any active investments
      if investor.total_shares > 0 || investor.total_options > 0 || investor.investment_amount_in_cents > 0
        return { success: false, error: "Cannot remove investor with active investments" }
      end

      investor.destroy!
      { success: true }
    end
end
