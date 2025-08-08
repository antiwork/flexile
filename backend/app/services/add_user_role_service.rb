# frozen_string_literal: true

class AddUserRoleService
  def initialize(company:, user_id:, role:)
    @company = company
    @user_id = user_id
    @role = role
  end

  def perform
    user = User.find_by(external_id: @user_id)
    return { success: false, error: "User not found" } unless user

    case @role
    when "admin"
      add_admin_role(user)
    when "lawyer"
      add_lawyer_role(user)
    when "contractor"
      add_contractor_role(user)
    when "investor"
      add_investor_role(user)
    else
      { success: false, error: "Invalid role. Must be one of: admin, lawyer, contractor, investor" }
    end
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

    def add_contractor_role(user)
      existing_contractor = @company.company_workers.find_by(user: user)
      return { success: false, error: "User is already a contractor" } if existing_contractor

      @company.company_workers.create!(
        user: user,
        started_at: Time.current,
        pay_rate_type: :hourly,
        role: "Contractor",
        contract_signed_elsewhere: false
      )
      { success: true }
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error: e.record.errors.full_messages.to_sentence }
    end

    def add_investor_role(user)
      existing_investor = @company.company_investors.find_by(user: user)
      return { success: false, error: "User is already an investor" } if existing_investor

      @company.company_investors.create!(
        user: user,
        total_shares: 0,
        total_options: 0,
        investment_amount_in_cents: 0
      )
      { success: true }
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error: e.record.errors.full_messages.to_sentence }
    end
end
