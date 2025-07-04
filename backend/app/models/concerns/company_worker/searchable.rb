# frozen_string_literal: true

module CompanyWorker::Searchable
  extend ActiveSupport::Concern

  included do
    include User::Searchable
  end

  def records_for_search
    {
      invoices: user.invoices.alive,
      company_workers: CompanyWorker.none,
      company_investors: CompanyInvestor.none,
    }
  end
end
