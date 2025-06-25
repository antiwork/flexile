# frozen_string_literal: true

class CompanyOnboardingPresenter
  def initialize(company)
    @company = company
  end

  def props
    {
      invite_contractor: company.contractors.exists?,
      add_bank_account: company.bank_account_added?,
      send_first_payment: company.payment_sent?,
      company_details: company.has_company_details?
    }
  end

  private
    attr_reader :company
end
