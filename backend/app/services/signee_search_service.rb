# frozen_string_literal: true

class SigneeSearchService
  RESULTS_LIMIT = 20
  SEARCHABLE_TYPES = %w[CompanyInvestor CompanyWorker CompanyAdministrator].freeze
  private_constant :RESULTS_LIMIT, :SEARCHABLE_TYPES

  def initialize(company:, query:)
    @company = company
    @query = query
  end

  def search
    PgSearch.multisearch(query)
      .where(company_id: company.id)
      .where(searchable_type: SEARCHABLE_TYPES)
      .includes(:searchable)
      .limit(RESULTS_LIMIT)
      .map(&:searchable)
      .sort_by { |r| r.user.legal_name }
  end

  private
    attr_reader :company, :query
end
