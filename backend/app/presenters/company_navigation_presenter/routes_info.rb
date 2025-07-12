# frozen_string_literal: true

class CompanyNavigationPresenter::RoutesInfo
  def initialize(current_context:)
    @current_context = current_context
    @user = current_context.user
    @company = current_context.company
    @company_administrator = current_context.company_administrator
    @company_worker = current_context.company_worker
    @company_investor = current_context.company_investor
    @company_lawyer = current_context.company_lawyer
  end

  def props
    @_props ||=
      [
        company_updates_route_props,
        company_invoices_route_props,
        company_documents_route_props,
        company_workers_route_props,
        company_equity_route_props,
        company_settings_route_props,
      ].compact
  end

  private
    attr_reader :current_context, :user, :company, :company_administrator, :company_worker, :company_investor, :company_lawyer

    def policy_allows?(record, action = :index)
      @policy_cache ||= {}
      key = [record, action]
      @policy_cache[key] ||= begin
        policy = Pundit.policy!(current_context, record)
        policy.public_send("#{action}?")
      end
    end

    def company_updates_route_props
      return unless policy_allows?(CompanyUpdate)

      {
        label: "Updates",
        name: "company_updates_company_index",
      }
    end

    def company_invoices_route_props
      return unless policy_allows?(Invoice)

      {
        label: "Invoices",
        name: "company_invoices",
      }
    end

    def company_documents_route_props
      {
        label: "Documents",
        name: "company_documents",
      }
    end

    def company_workers_route_props
      return unless policy_allows?(CompanyWorker)

      {
        label: "People",
        name: "company_workers",
      }
    end

    def company_equity_route_props
      name = \
        if company.cap_table_enabled?
          "company_cap_table"
        elsif policy_allows?(Dividend)
          "company_dividends"
        elsif policy_allows?(EquityGrant)
          "company_equity_grants"
        elsif policy_allows?(DividendRound)
          "company_dividend_rounds"
        end
      return unless name

      {
        label: "Equity",
        name:,
      }
    end

    def company_settings_route_props
      if policy_allows?(current_context.company, :show)
        {
          label: "Settings",
          name: "company_administrator_settings",
        }
      elsif policy_allows?(EquityAllocation, :show)
        {
          label: "Settings",
          name: "company_settings_equity",
        }
      end
    end
end
