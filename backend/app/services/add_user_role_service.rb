# frozen_string_literal: true

class AddUserRoleService
  ALLOWED_ROLES = {
    "admin" => :add_admin_role,
    "lawyer" => :add_lawyer_role,
    "contractor" => :add_contractor_role,
    "investor" => :add_investor_role,
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
