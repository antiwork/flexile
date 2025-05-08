# frozen_string_literal: true

module CompanyAdministrator::Searchable
  extend ActiveSupport::Concern

  included do
    include User::Searchable
  end

  def records_for_search
    {
      invoices: company.invoices,
      company_workers: company.company_workers,
      company_investors: company.company_investors,
    }
  end
end
