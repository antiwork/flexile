# frozen_string_literal: true

class UserPresenter
  delegate :country_code, :citizenship_country_code, :street_address, :city, :state, :zip_code, :email,
           :documents, :business_name, :business_entity?, :display_country,
           :legal_name, :preferred_name, :display_name, :billing_entity_name, :unconfirmed_email,
           :created_at, :state, :city, :zip_code, :street_address, :bank_account, :contracts, :tax_id, :birth_date,
           :requires_w9?, :tax_information_confirmed_at, :minimum_dividend_payment_in_cents, :wallet, :bank_accounts,
           :tax_id_status, private: true, to: :user, allow_nil: true

  def initialize(current_context:, selected_access_roles_by_company: {})
    @current_context = current_context
    @user = current_context.user
    @company = current_context.company
    @company_administrator = current_context.company_administrator
    @company_worker = current_context.company_worker
    @company_investor = current_context.company_investor
    @company_lawyer = current_context.company_lawyer
    @selected_access_roles_by_company = selected_access_roles_by_company
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

  def legal_details_props
    {
      user: {
        collect_tax_info: current_context.company_investor? || (current_context.company_worker? && current_context.company.irs_tax_forms?),
        legal_name:,
        street_address:,
        city:,
        state:,
        zip_code:,
        zip_code_label:,
        business_entity: business_entity?,
        business_name:,
        is_foreign: !requires_w9?,
        tax_id:,
        birth_date: birth_date&.to_s,
      },
      states: ISO3166::Country[country_code].subdivision_names_with_codes.sort,
    }
  end

  def logged_in_user
    companies = if user.inviting_company?
      []
    else
      user.all_companies
    end
    any_type = \
      if user.company_administrator_for?(company)
        Company::ACCESS_ROLE_ADMINISTRATOR
      elsif user.company_lawyer_for?(company)
        Company::ACCESS_ROLE_LAWYER
      elsif user.company_investor_for?(company) && !user.company_worker_for?(company)
        Company::ACCESS_ROLE_INVESTOR
      else
        Company::ACCESS_ROLE_WORKER
      end

    type = current_context.role || any_type

    roles = {}
    has_documents = documents.joins(:signatures).not_consulting_contract.or(documents.unsigned).exists?
    if user.company_administrator_for?(company)
      administrator = user.company_administrator_for(company)
      roles[Company::ACCESS_ROLE_ADMINISTRATOR] = {
        id: administrator.id.to_s,
        isBoardMember: administrator.board_member?,
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
      role = worker.company_role
      roles[Company::ACCESS_ROLE_WORKER] = {
        id: worker.external_id,
        hasDocuments: has_documents,
        endedAt: worker.ended_at,
        payRateType: worker.pay_rate_type,
        inviting_company: user.inviting_company,
        role: role ? { name: role.name, expenseCardEnabled: role.expense_card_enabled? } : nil,
        payRateInSubunits: worker.pay_rate_in_subunits,
        onTrial: worker.on_trial?,
        hoursPerWeek: worker.hours_per_week,
      }
    end

    {
      companies: companies.compact.map do |company|
        flags = %w[upcoming_dividend irs_tax_forms expense_cards company_updates salary_roles].filter { Flipper.enabled?(_1, company) }
        flags.push("team_updates") if company.team_updates_enabled?
        flags.push("equity_compensation") if company.equity_compensation_enabled?
        flags.push("equity_grants") if company.equity_grants_enabled?
        flags.push("financing_rounds") if company.financing_rounds_enabled?
        flags.push("dividends") if company.dividends_allowed?
        flags.push("quickbooks") if company.quickbooks_enabled?
        flags.push("tender_offers") if company.tender_offers_enabled?
        flags.push("cap_table") if company.cap_table_enabled?
        flags.push("lawyers") if company.lawyers_enabled?
        flags.push("expenses") if company.expenses_enabled?
        flags.push("irs_tax_forms") if company.irs_tax_forms?
        flags.push("equity_compensation") if company.equity_compensation_enabled?
        flags.push("option_exercising") if company.json_flag?("option_exercising")
        can_view_financial_data = user.company_administrator_for?(company) || user.company_investor_for?(company)
        {
          **company_navigation_props(
            company:,
            selected_access_role: selected_access_roles_by_company[company.external_id]
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
          expenseCardsEnabled: company.expense_cards_enabled,
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
        }
      end,
      id: user.external_id,
      currentCompanyId: company&.external_id,
      name: user.display_name,
      legalName: legal_name,
      preferredName: preferred_name,
      billingEntityName: billing_entity_name,
      activeRole: [Company::ACCESS_ROLE_ADMINISTRATOR, Company::ACCESS_ROLE_LAWYER].include?(type) ? type : "contractorOrInvestor",
      roles:,
      address: {
        street_address: user.street_address,
        city: user.city,
        zip_code: user.zip_code,
        state: user.state,
        country_code: user.country_code,
        country: user.country_code && ISO3166::Country[user.country_code].common_name,
      },
      email: user.display_email,
      onboardingPath: OnboardingState::User.new(user:, company:).redirect_path,
    }
  end

  private
    attr_reader :current_context, :user, :company, :company_administrator, :company_worker, :company_investor, :company_lawyer, :selected_access_roles_by_company

    def user_props
      is_inviting_company = user.inviting_company?

      result = common_props.merge(
        is_worker: company_worker.present?,
        is_investor: company_investor.present?,
        is_inviting_company:,
        flags: {},
      )
      result[:has_documents] = documents.not_consulting_contract.or(documents.unsigned).exists?
      if company_worker.present?
        result[:flags][:irs_tax_forms] = company.irs_tax_forms?
        if company_worker.active?
          result[:flags][:equity] = true if company_worker.hourly?
          result[:flags][:cap_table] = true if company.is_gumroad? && company.cap_table_enabled?
          result[:flags][:upcoming_dividend] = Flipper.enabled?(:upcoming_dividend, company)
          result[:flags][:expense_cards] = company.expense_cards_enabled?
        end
      end
      if company_investor.present?
        result[:flags][:cap_table] ||= true if company.cap_table_enabled?
        result[:flags][:financing_rounds] ||= true if company.financing_rounds_enabled?
        result[:flags][:option_exercising] = company.json_flag?("option_exercising")
        result[:flags][:equity_grants] = company.equity_grants_enabled?
        result[:flags][:upcoming_dividend] ||= Flipper.enabled?(:upcoming_dividend, company)
        result[:flags][:tender_offers] ||= company.tender_offers_enabled?
        result[:flags][:irs_tax_forms] ||= company.irs_tax_forms?
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
          equity_grants: company.equity_grants_enabled?,
          cap_table: company.cap_table_enabled?,
          financing_rounds: company.financing_rounds_enabled?,
          upcoming_dividend: Flipper.enabled?(:upcoming_dividend, company),
          tender_offers: company.tender_offers_enabled?,
          dividends: company.dividends_allowed?,
          irs_tax_forms: company.irs_tax_forms?,
          company_updates: company.company_updates_enabled?,
          salary_roles: Flipper.enabled?(:salary_roles, company),
          expense_cards: company.expense_cards_enabled?,
        },
      }
    end

    def common_props
      companies = if user.inviting_company?
        []
      else
        user.all_companies
      end

      {
        company: company.present? && !user.inviting_company? ? {
          id: company.external_id,
          name: company.display_name,
          logo_url: company.logo_url,
        } : nil,
        companies: companies.compact.map do
          company_navigation_props(
            company: _1,
            selected_access_role: selected_access_roles_by_company[_1.external_id]
          )
        end,
        legal_name:,
      }
    end

    def company_navigation_props(company:, selected_access_role:)
      current_company_access_role = current_context.company == company ? current_context.role : nil
      selected_access_role ||= current_company_access_role
      CompanyNavigationPresenter.new(user: current_context.user, company:, selected_access_role:).props
    end
end
