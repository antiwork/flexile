# frozen_string_literal: true

class LeaveCompanyService
  attr_reader :user, :company

  def initialize(user:, company:)
    @user = user
    @company = company
  end

  def call
    ApplicationRecord.transaction do
      validate_user_can_leave!
      remove_user_roles!
      { success: true }
    end
  rescue StandardError => e
    { success: false, error: e.message }
  end

  private

    def validate_user_can_leave!
      if user_is_administrator?
        raise "Administrators cannot leave a company."
      end

      unless user_has_leavable_role?
        raise "You do not have permission to leave this company."
      end

      # Only check contract restrictions if user is a contractor
      contractor = user.company_workers.find_by(company: company)
      if contractor&.contract_signed_elsewhere
        raise "You cannot leave the workspace because you have a contract signed elsewhere."
      end

      if contractor&.active_contract?
        raise "You cannot leave the workspace with an active contract."
      end
    end

  def remove_user_roles!
    user.company_workers.where(company: company).delete_all
    user.company_investors.where(company: company).delete_all
    user.company_lawyers.where(company: company).delete_all
  end

  def user_is_administrator?
    user.company_administrators.exists?(company: company)
  end

  def user_has_leavable_role?
    user.company_workers.exists?(company: company) ||
      user.company_investors.exists?(company: company) ||
      user.company_lawyers.exists?(company: company)
  end
end
