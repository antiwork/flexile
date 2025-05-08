# frozen_string_literal: true

class SearchService
  RESULTS_LIMIT = 6
  private_constant :RESULTS_LIMIT

  def initialize(company:, records_for_search:, query:)
    @company = company
    @records_for_search = records_for_search
    @query = query
  end

  def search
    {
      invoices: limit(filter(@records_for_search[:invoices]).order(invoice_date: :desc)),
      company_workers: limit(filter(@records_for_search[:company_workers]).joins(:user).order(:legal_name)),
      company_investors: limit(filter(@records_for_search[:company_investors]).joins(:user).order(:legal_name)),
    }
  end

  private
    def filter(objects)
      search_result_ids = search_results
                            .where(searchable_type: objects.model.name)
                            .pluck(:searchable_id)

      objects.where(id: search_result_ids)
    end

    def search_results
      @_results ||= PgSearch
                      .multisearch(@query)
                      .where(company_id: @company.id)
    end

    def limit(objects)
      objects.limit(RESULTS_LIMIT)
    end
end
