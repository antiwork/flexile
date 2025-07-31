# frozen_string_literal: true

class UserPresenter
  delegate :country_code, :citizenship_country_code, :street_address, :city, :state, :zip_code, :email,
           :documents, :business_name, :business_entity?, :display_country,
           :legal_name, :preferred_name, :display_name, :billing_entity_name, :unconfirmed_email,
           :created_at, :state, :city, :zip_code, :street_address, :bank_account, :contracts, :tax_id, :birth_date,
           :requires_w9?, :tax_information_confirmed_at, :minimum_dividend_payment_in_cents, :bank_accounts,
           :tax_id_status, private: true, to: :user, allow_nil: true

  def initialize(current_context:)
    @current_context = current_context
    @user = current_context.user
    @company = current_context.company
    @company_administrator = current_context.company_administrator
    @company_worker = current_context.company_worker
    @company_investor = current_context.company_investor
    @company_lawyer = current_context.company_lawyer
  end

  def zip_code_label
    country_code == "US" ? "Zip code" : "Postal code"
  end

  def personal_details_props
    {
      legal_name:,
      preferred_name:,
      country_code:,
      citizenship_country_code: citizenship_country_code || country_code,
    }
  end

  def billing_details_props
    {
      email:,
      country: user.display_country,
      country_code:,
      state:,
      city:,
      zip_code:,
      street_address:,
      billing_entity_name:,
      legal_type: business_entity? ? "BUSINESS" : "PRIVATE",
      unsigned_document_id: documents.unsigned.where.not(docuseal_submission_id: nil).first&.id,
    }
  end

  def logged_in_user
    roles = {}
    has_documents = documents.joins(:signatures).not_consulting_contract.or(documents.unsigned).exists?
    if user.company_administrator_for?(company)
      administrator = user.company_administrator_for(company)
      roles[Company::ACCESS_ROLE_ADMINISTRATOR] = {
        id: administrator.id.to_s,
        isInvited: !!user.invited_by&.company_worker_for?(company),
      }
    end
    if user.company_lawyer_for?(company)
      roles[Company::ACCESS_ROLE_LAWYER] = {
        id: user.company_lawyer_for(company).external_id,
      }
    end
    if user.company_investor_for?(company)
      investor = user.company_investor_for(company)
      roles[Company::ACCESS_ROLE_INVESTOR] = {
        id: investor.external_id,
        hasDocuments: has_documents,
        hasGrants: investor.equity_grants.accepted.eventually_exercisable.exists?,
        hasShares: investor.share_holdings.exists?,
        hasConvertibles: investor.convertible_securities.exists?,
        investedInAngelListRuv: investor.invested_in_angel_list_ruv,
      }
    end
    if user.company_worker_for?(company)
      worker = user.company_worker_for(company)
      roles[Company::ACCESS_ROLE_WORKER] = {
        id: worker.external_id,
        hasDocuments: has_documents,
        endedAt: worker.ended_at,
        payRateType: worker.pay_rate_type,
        role: worker.role,
        payRateInSubunits: worker.pay_rate_in_subunits,
        equityPercentage: worker.equity_percentage,
      }
    end

    {
      companies: user.all_companies.compact.map do |company|
        flags = []
        flags.push("equity") if company.equity_enabled?
        flags.push("company_updates") if company.company_investors.exists?
        flags.push("quickbooks") if company.quickbooks_enabled?
        flags.push("expenses") if company.expenses_enabled?
        flags.push("option_exercising") if company.json_flag?("option_exercising")
        can_view_financial_data = user.company_administrator_for?(company) || user.company_investor_for?(company)
        {
          **company_navigation_props(
            company:,
          ),
          address: {
            street_address: company.street_address,
            city: company.city,
            zip_code: company.zip_code,
            state: company.state,
            country_code: company.country_code,
            country: ISO3166::Country[company.country_code].common_name,
          },
          flags:,
          equityEnabled: company.equity_enabled,
          requiredInvoiceApprovals: company.required_invoice_approval_count,
          paymentProcessingDays: company.contractor_payment_processing_time_in_days,
          createdAt: company.created_at.iso8601,
          fullyDilutedShares: can_view_financial_data ? company.fully_diluted_shares : nil,
          valuationInDollars: can_view_financial_data ? company.valuation_in_dollars : nil,
          sharePriceInUsd: can_view_financial_data ? company.share_price_in_usd.to_s : nil,
          conversionSharePriceUsd: can_view_financial_data ? company.conversion_share_price_usd.to_s : nil,
          exercisePriceInUsd: can_view_financial_data ? company.fmv_per_share_in_usd.to_s : nil,
          investorCount: user.company_administrator_for?(company) ? company.company_investors.where.not(user_id: company.company_workers.active.select(:user_id)).count : nil,
          contractorCount: user.company_administrator_for?(company) ? company.company_workers.active.count : nil,
          primaryAdminName: company.primary_admin.user.name,
          completedPaymentMethodSetup: company.bank_account_ready?,
          isTrusted: company.is_trusted,
          checklistItems: company.checklist_items(user),
          checklistCompletionPercentage: company.checklist_completion_percentage(user),
        }
      end,
      id: user.external_id,
      currentCompanyId: company&.external_id,
      name: user.display_name,
      legalName: legal_name,
      preferredName: preferred_name,
      billingEntityName: billing_entity_name,
      roles:,
      hasPayoutMethodForInvoices: user.bank_account.present?,
      hasPayoutMethodForDividends: user.bank_account_for_dividends.present?,
      address: {
        street_address: user.street_address,
        city: user.city,
        zip_code: user.zip_code,
        state: user.state,
        country_code: user.country_code,
        country: user.country_code && ISO3166::Country[user.country_code].common_name,
      },
      email: user.display_email,
      onboardingPath: worker && worker.role.nil? ? "/documents" : nil,
      taxInformationConfirmedAt: tax_information_confirmed_at&.iso8601,
    }
  end

  private
    attr_reader :current_context, :user, :company, :company_administrator, :company_worker, :company_investor, :company_lawyer

    def user_props
      result = common_props.merge(
        is_worker: company_worker.present?,
        is_investor: company_investor.present?,
        flags: {},
      )
      result[:has_documents] = documents.not_consulting_contract.or(documents.unsigned).exists?
      if company_worker.present?
        if company_worker.active?
          result[:flags][:equity] = true if company.is_gumroad? && company.equity_enabled?
        end
      end
      if company_investor.present?
        result[:flags][:equity] ||= true if company.equity_enabled?
        result[:flags][:option_exercising] = company.json_flag?("option_exercising")
      end
      result
    end

    def company_admin_props
      common_props.deep_merge(common_admin_props).merge(
        is_company_admin: true,
        is_invited: !!user.invited_by&.company_worker_for?(company)
      )
    end

    def company_lawyer_props
      common_props.deep_merge(common_admin_props).merge(is_company_lawyer: true)
    end

    def common_admin_props
      {
        flags: {
          equity: company.equity_enabled?,
          company_updates: company.company_investors.exists?,
        },
      }
    end

    def common_props
      {
        company: company.present? ? {
          id: company.external_id,
          name: company.display_name,
          logo_url: company.logo_url,
        } : nil,
        companies: user.all_companies.compact.map do
          company_navigation_props(
            company: _1,
          )
        end,
        legal_name:,
      }
    end

    def company_navigation_props(company:)
      CompanyNavigationPresenter.new(user: current_context.user, company:).props
    end
end
