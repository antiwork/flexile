# frozen_string_literal: true

class RemoveUserRoleService
  def initialize(company:, user_id:, role:, current_user:)
    @company = company
    @user_id = user_id
    @role = role
    @current_user = current_user
  end

  def perform
    user = User.find_by(external_id: @user_id)
    return { success: false, error: "User not found" } unless user

    case @role
    when "admin"
      remove_admin_role(user)
    when "lawyer"
      remove_lawyer_role(user)
    when "contractor"
      remove_contractor_role(user)
    when "investor"
      remove_investor_role(user)
    else
      { success: false, error: "Invalid role. Must be one of: admin, lawyer, contractor, investor" }
    end
  end

  private
    def remove_admin_role(user)
      # Prevent removing own admin role
      if @current_user.id == user.id
        return { success: false, error: "You cannot remove your own admin role" }
      end

      # Prevent removing last administrator
      admin_count = @company.company_administrators.count
      if admin_count == 1 && @company.company_administrators.exists?(user: user)
        return { success: false, error: "Cannot remove the last administrator" }
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
