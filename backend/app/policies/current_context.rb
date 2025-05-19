# frozen_string_literal: true

# Determines roles for the logged-in user based on the company and role selected
# If the role is nil (feature not enabled), all available roles are returned
#
class CurrentContext
  def self.from_current(current)
    new(
      user: current.user,
      company: current.company,
    )
  end

  attr_reader :user, :company

  def initialize(user:, company:)
    @user = user
    @company = company
  end

  def company_administrator
    @_company_administrator ||= user&.company_administrator_for(company)
  end

  def company_worker
    @_company_worker ||= user&.company_worker_for(company)
  end

  def company_investor
    @_company_investor ||= user&.company_investor_for(company)
  end

  def company_lawyer
    @_company_lawyer ||= user&.company_lawyer_for(company)
  end

  def company_administrator?
    company_administrator.present?
  end

  def company_worker?
    company_worker.present?
  end

  def company_investor?
    company_investor.present?
  end

  def company_lawyer?
    company_lawyer.present?
  end

  def inspect
    "#<CurrentContext user_email=#{user&.email} company_name=#{company&.name}>"
  end
end
