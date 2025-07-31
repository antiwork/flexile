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
    end
  rescue => e
    Bugsnag.notify(e)
    { success: false, error: e.message }
  else
    { success: true }
  end

  private
    def validate_user_can_leave!
      if user_is_administrator?
        raise "Administrators cannot leave a company."
      end

      unless user_has_leavable_role?
        raise "You do not have permission to leave this company."
      end
    end

    def remove_user_roles!
      # Set ended_at for contractors to mark contract end date (preserve contract history)
      user.company_workers.where(company: company).update_all(ended_at: Time.current)

      # Remove investors and lawyers completely (no contract history needed)
      user.company_investors.where(company: company).delete_all
      user.company_lawyers.where(company: company).delete_all
    end

    def user_is_administrator?
      user.company_administrators.exists?(company: company)
    end

    def user_has_leavable_role?
      user.company_workers.active.exists?(company: company) ||
        user.company_investors.exists?(company: company) ||
        user.company_lawyers.exists?(company: company)
    end
end
