# frozen_string_literal: true

require "faker"
require "timecop"
require "tempfile"
require "zip"
require "prawn"

require Rails.root.join("lib", "aws_s3_client_timecop")
require Rails.root.join("lib", "sidekiq_job_force_perform_inline")

# Generates seed data from a template
#
# Usage:
#   bin/rails runner 'SeedDataGeneratorFromTemplate.new(template: "gumroad").perform!'
#
# For development, email should be set to a valid email address that supports aliases (like Gmail), so that records use
# valid email addresses that will have the emails delivered to the same inbox.
#
# For a faster execution (less seed data is generated), set fast_mode to true.
#   bin/rails runner 'SeedDataGeneratorFromTemplate.new(template: "gumroad", fast_mode: true).perform!'
#
class SeedDataGeneratorFromTemplate
  DEFAULT_PASSWORD = "password"
  EMAIL_DOMAIN_FOR_RANDOM_USER = "random.flexile.example.com"
  FAST_MODE_RANDOM_RECORDS_METADATA_COUNT = 2

  include ActionView::Helpers::NumberHelper

  def initialize(template:, email: nil, fast_mode: false)
    raise "This code should never be run in production." if Rails.env.production?

    Current.whodunnit = self.class.name
    Timecop.safe_mode = true
    Aws::S3::Client.prepend(AwsS3ClientTimecop)

    @template = template
    @fast_mode = fast_mode
    template_json = load_template(template)
    @config = template_json["config"]
    @data = template_json["data"]
    @current_time = Time.current

    @config["email"] = email if email.present?
  end

  def perform!
    # Jobs that need to be performed inline so that the seed data is created correctly
    SidekiqJobForcePerformInline.force_inline_class_names = [
      GenerateContractorInvitationJob,
      ChargeConsolidatedInvoiceJob,
      PayInvoiceJob,
    ]
    SidekiqJobForcePerformInline.apply

    print_message("Using email #{@config.fetch("email")}.")
    WiseCredential.create!(profile_id: WISE_PROFILE_ID, api_key: WISE_API_KEY)
    ActiveRecord::Base.connection.exec_query("INSERT INTO document_templates(name, external_id, created_at, updated_at, document_type, docuseal_id, signable) VALUES('name', 'Consulting agreement', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 592723, true)")
    Wise::AccountBalance.create_usd_balance_if_needed
    top_up_wise_account_if_needed

    create_users!(data.fetch("users"))

    company_data = data.fetch("company")
    company = create_company!(company_data)
    Timecop.travel(company.created_at) do
      Timecop.scale(3600 * 24 * 30) do # 1 second = 1 month
        update_primary_administrator!(company, company_data.fetch("primary_administrator"))
        create_bank_account!(company)
        enable_feature_flags!(company, company_data.fetch("feature_flags"))
        create_convertible_investments!(company, company_data)
        create_dividend_rounds!(company, company_data)
        create_financing_rounds!(company, company_data)
        create_tender_offer!(company, company_data.fetch("tender_offer"))
        create_equity_buyback_rounds!(company, company_data)
        create_company_monthly_financial_reports!(company, company_data.fetch("company_monthly_financial_reports"))
        create_expense_categories!(company, company_data.fetch("expense_categories"))
        create_other_administrators!(company, company_data.fetch("other_administrators"))
        create_lawyers!(company, company_data.fetch("lawyers"))
        create_company_investor_and_data!(company, company.primary_admin.user, company_data.fetch("primary_administrator"))
        create_investors!(company, company_data.fetch("investors"))
        create_company_updates!(company, company_data.fetch("company_updates"))
        create_company_roles_and_contractors!(
          company,
          company_data.fetch("company_roles_and_contractors"),
          company_data.fetch("company_worker_updates")
        )
        create_consolidated_invoices!(company)
      end
    end
  ensure
    SidekiqJobForcePerformInline.revert
  end

  private
    attr_reader :fast_mode, :config, :data, :template, :current_time

    class Error < StandardError; end

    def load_template(template_name)
      file_path = Rails.root.join("config", "data", "seed_templates", "#{template_name}.json")
      JSON.parse(File.read(file_path))
    end

    def create_users!(users_data)
      users_data.each do |user_data|
        create_user!(nil, user_data.fetch("model_attributes"))
      end
    end

    def create_company!(company_data)
      model_attributes = company_data.fetch("model_attributes")
      company = nil
      Timecop.travel(Time.zone.parse(model_attributes["created_at"])) do
        company_name = model_attributes.fetch("name")
        result = SignUpCompany.new(
          user_attributes: {
            email: config.fetch("email"),
            password: DEFAULT_PASSWORD,
            confirmed_at: Time.current,
          },
          ip_address: "127.0.0.1"
        ).perform

        user = result[:user]
        success = result[:success]
        error_message = result[:error_message]

        raise Error, "An error occurred creating #{company_name} - error: #{error_message}" unless success

        company = user.company_administrators.first.company
        company.update!(model_attributes)
        logo_path = Rails.root.join("config", "data", "seed_templates", template, "logo.png")
        if File.exist?(logo_path)
          logo_content = File.binread(logo_path)
          filename = File.basename(logo_path)
          company.logo.attach(io: StringIO.new(logo_content), filename: filename)
          company.full_logo.attach(io: StringIO.new(logo_content), filename: filename)
          company.save!
        end

        if company_data.key?("share_classes")
          company_data.fetch("share_classes").each do |share_class_data|
            company.share_classes.create!(share_class_data.fetch("model_attributes"))
          end
        end

        if company_data.key?("option_pool")
          option_pool_data = company_data.fetch("option_pool")
          model_attributes = option_pool_data.fetch("model_attributes")
          year = option_pool_data.fetch("year")
          option_pool = nil
          Timecop.travel(Date.new(year, 1, 1)) do
            option_pool = company.option_pools.create!(
              share_class: company.share_classes.find_by!(name: option_pool_data.fetch("share_class").fetch("name")),
              **model_attributes.reverse_merge(
                {
                  name: (year ? "#{year} Equity Plan" : nil),
                }.compact
              )
            )
          end
          print_message("Created stock option pool - #{option_pool.name}")
        end
        if company_data.key?("equity_exercise_bank_account")
          EquityExerciseBankAccount.create!(
            company:,
            **company_data.fetch("equity_exercise_bank_account").fetch("model_attributes")
          )
        end
      end
      print_message("Created company #{company.name}#{company.completed_onboarding? ? " (completed onboarding)" : nil}")
      company
    end

    def create_bank_account!(company)
      stripe_setup_intent = company.fetch_stripe_setup_intent
      # https://docs.stripe.com/testing#test-account-numbers
      test_bank_account = Stripe::PaymentMethod.create(
        {
          type: "us_bank_account",
          us_bank_account: {
            account_holder_type: "individual",
            account_type: "checking",
            account_number: "000123456789",
            routing_number: "110000000",
          },
          billing_details: {
            name: company.primary_admin.user.legal_name,
            email: company.email,
            address: {
              city: company.city,
              country: company.country_code,
              line1: company.street_address,
              line2: nil,
              postal_code: company.zip_code,
              state: company.state,
            },
          },
        }
      )
      Stripe::SetupIntent.confirm(
        stripe_setup_intent.id,
        payment_method: test_bank_account.id,
        mandate_data: {
          customer_acceptance: {
            type: "offline",
          },
        }
      )
      Stripe::SetupIntent.verify_microdeposits(
        stripe_setup_intent.id,
        {
          amounts: [32, 45],
        },
      )
      Stripe::PaymentMethod.attach(
        test_bank_account.id, { customer: stripe_setup_intent.customer }
      )
      company.bank_account.update!(
        status: CompanyStripeAccount::READY,
        setup_intent_id: stripe_setup_intent.id,
        bank_account_last_four: test_bank_account.us_bank_account.last4,
      )
    end

    def create_convertible_investments!(company, company_data)
      print_message("Creating convertible investments")
      company_data.fetch("convertible_investments").each do |convertible_investment_data|
        model_attributes = convertible_investment_data.fetch("model_attributes")
        issued_at = model_attributes.fetch("issued_at")
        implied_shares = model_attributes.fetch("implied_shares")
        Timecop.travel(issued_at) do
          convertible_investment = company.convertible_investments.create!(model_attributes.merge(implied_shares: 1))
          if convertible_investment_data.fetch("convertible_securities").key?("random_records_metadata")
            random_records_metadata = convertible_investment_data.fetch("convertible_securities").fetch("random_records_metadata")
            investor_count = fast_mode ? FAST_MODE_RANDOM_RECORDS_METADATA_COUNT : random_records_metadata.fetch("count")
            investment_amounts = allocate_investments(
              total_investment_in_cents: convertible_investment.amount_in_cents,
              investor_count:,
              minimum_investment_in_cents: 1_000_00
            )

            investment_amounts.shuffle.each_with_index do |investment_amount_in_cents, i|
              user_params = {
                password: DEFAULT_PASSWORD,
                email: "ci-investor-#{i}@#{EMAIL_DOMAIN_FOR_RANDOM_USER}",
                tax_id: Faker::Number.number(digits: 9),
                legal_name: Faker::Name.name,
              }
              compliance_params = user_params.extract!(*User::USER_PROVIDED_TAX_ATTRIBUTES)
              user = User.create!(**user_params)
              user.create_compliance_info!(compliance_params)
              company_investor = user.company_investors.create!(company:, investment_amount_in_cents: [investment_amount_in_cents, 1].max)
              convertible_investment.convertible_securities.create!(
                company_investor:,
                issued_at: Time.current,
                principal_value_in_cents: investment_amount_in_cents,
                implied_shares: 1,
              )
              print_message(".", on_new_line: false)
            end
          end
          convertible_investment.update!(implied_shares:)
        end
      end
    end

    def allocate_investments(total_investment_in_cents:, investor_count:, minimum_investment_in_cents:)
      remaining_investment_amount = total_investment_in_cents - minimum_investment_in_cents * investor_count
      average_investment_in_cents = [remaining_investment_amount / investor_count, 1].max

      base_allocations = Array.new(investor_count) { [rand(average_investment_in_cents * 0.8..average_investment_in_cents * 1.2).round, 1].max }
      total_allocated = base_allocations.sum

      while total_allocated < remaining_investment_amount
        index = rand(investor_count)
        base_allocations[index] += 1
        total_allocated += 1
      end

      investment_allocations = base_allocations.map { |allocation| allocation + minimum_investment_in_cents }

      # Final adjustment to ensure the sum matches the total investment amount
      adjustment = total_investment_in_cents - investment_allocations.sum
      investment_allocations[0] += adjustment

      investment_allocations.map { |amount| [amount, 1].max }
    end

    def create_dividend_rounds!(company, company_data)
      created_at = company.created_at
      company_data.fetch("dividend_rounds").each do |dividend_round_data|
        company.dividend_rounds.create!(
          dividend_round_data.fetch("model_attributes").reverse_merge(
            issued_at: company.created_at,
            number_of_shareholders: company_data.fetch("investors").count,
            return_of_capital: false,
          )
        )
        created_at += 1.year
      end
    end

    def create_financing_rounds!(company, company_data)
      company_data.fetch("financing_rounds").each do |financing_round_data|
        company.financing_rounds.create!(financing_round_data)
      end
    end

    def create_equity_buyback_rounds!(company, company_data)
      common_attrs = {
        tender_offer: company.tender_offers.last!,
        issued_at: current_time - 1.day,
      }
      company_data.fetch("equity_buyback_rounds").each do |equity_buyback_round_data|
        company.equity_buyback_rounds.create!(**common_attrs, **equity_buyback_round_data)
      end
    end

    def create_tender_offer!(company, tender_offer_data)
      return unless company.tender_offers_enabled?

      starts_at = current_time - 1.week
      Timecop.travel(starts_at) do
        result = CreateTenderOffer.new(
          company:,
          attributes: tender_offer_data.reverse_merge(
            starts_at:,
            ends_at: 3.months.from_now,
            attachment: create_temporary_zip_file
          )
        ).perform
        if !result[:success]
          raise Error, "Error creating tender offer: #{result.inspect}"
        end
      end
    end

    def create_company_monthly_financial_reports!(company, company_monthly_financial_reports_data)
      count = fast_mode ? FAST_MODE_RANDOM_RECORDS_METADATA_COUNT : company_monthly_financial_reports_data.fetch("random_records_metadata").fetch("count")
      report_datetime = (current_time - count.months).beginning_of_month
      while report_datetime < current_time - 1.month
        company.company_monthly_financial_reports.create!(
          month: report_datetime.month,
          year: report_datetime.year,
          revenue_cents: rand(10_000_00..100_000_00),
          net_income_cents: rand(-10_000_00..50_000_00)
        )
        report_datetime += 1.month
      end
    end

    def create_company_updates!(company, company_updates_data)
      print_message("Creating company updates")
      count = fast_mode ? FAST_MODE_RANDOM_RECORDS_METADATA_COUNT : company_updates_data.fetch("random_records_metadata").fetch("count")
      start_date = (current_time - count.months).end_of_month
      count.times do |i|
        period_started_on = (start_date + i.months).beginning_of_month
        body = <<-HTML.strip_heredoc
            <p><strong>Product updates</strong></p>
            <p>
              We've rolled out several new features this month to improve the user experience for both creators and
              customers. Our new analytics dashboard has been well-received, providing creators with more detailed
              insights into their sales and audience engagement.
            </p>
            <p><strong>Creator Highlights</strong></p>
            <p>
              Our creators continue to amaze us with their creativity and entrepreneurial spirit.
              This month, we welcomed 500 new creators to the Gumroad family, and their products have already started to
              make a mark in their respective categories.
            </p>
            <p><strong>Looking Ahead</strong></p>
            <p>
              Looking forward, we're excited about the potential of several new initiatives. We're in the early stages of
              developing a mobile app to make Gumroad more accessible to creators and customers on the go. We're also exploring
              partnerships with other platforms to expand our reach and provide more opportunities for our creators.
            </p>
        HTML
        Timecop.travel(period_started_on.end_of_month) do
          result = CreateOrUpdateCompanyUpdate.new(
            company:,
            company_update_params: {
              period: :month,
              period_started_on:,
              title: "#{period_started_on.strftime("%B %Y")} update",
              body:,
              video_url: "https://youtu.be/CNes_Qfo0gw?si=_IIuWAgtouj95zEu",
              show_net_income: true,
              show_revenue: true,
            }
          ).perform!
          company_update = result[:company_update]
          # Do not publish the last update
          PublishCompanyUpdate.new(company_update).perform! if i < count - 1
        end
        print_message(".", on_new_line: false)
      end
    end

    def update_primary_administrator!(company, administrator_data)
      administrator = company.administrators.first!
      model_attributes = administrator_data.fetch("model_attributes")
      administrator.update!(
        model_attributes.reverse_merge(
          password: DEFAULT_PASSWORD,
          team_member: true,
        )
      )
      print_message("Updated primary administrator #{administrator.email}.")
      administrator
    end

    def create_other_administrators!(company, company_users_data)
      return if company_users_data.none?
      company_users_data.each do |company_user_data|
        user = create_user!(company, company_user_data.fetch("model_attributes"))
        company.company_administrators.create!(user:)
      end
      print_message("Created other administrators.")
    end

    def create_lawyers!(company, company_users_data)
      return if company_users_data.none?

      company_users_data.each do |company_user_data|
        user = create_user!(company, company_user_data.fetch("model_attributes"))
        company.company_lawyers.create!(user:)
      end
      print_message("Created #{company_users_data.count} #{"lawyer account".pluralize(company_users_data.count)}.")
    end

    def create_investors!(company, company_users_data)
      return if company_users_data.none?


      company_users_data.each do |company_user_data|
        user = create_user!(company, company_user_data.fetch("model_attributes"))
        create_company_investor_and_data!(company, user, company_user_data)
      end
      print_message("Created investors.")
    end

    def create_user!(company, user_attributes)
      email_identifier = user_attributes.dig("preferred_name") || user_attributes.fetch("legal_name").split.first
      Timecop.travel(user_attributes.dig("created_at")) do
        User.create!(
          user_attributes.reverse_merge(
            confirmed_at: Time.current,
            password: DEFAULT_PASSWORD,
            email: generate_email(email_identifier),
            invited_by: company&.administrators&.first!,
          )
        )
      end
    end

    def create_company_investor_and_data!(company, user, company_user_data)
      user_compliance_info = create_user_compliance_info!(
        user,
        company_user_data.fetch("user_compliance_info_attributes")
      )
      company_investor = company.company_investors.create!(
        user:,
        company:,
        **company_user_data.fetch("company_investor_attributes"),
      )
      create_user_bank_account!(user, company_user_data.fetch("wise_recipient_attributes"))
      share_class = company.share_classes.find_by!(
        name: company_user_data.fetch("share_holding_data").fetch("share_class").fetch("name")
      )
      share_holding = company_investor.share_holdings.create!(
        share_class:,
        **company_user_data.fetch("share_holding_data").fetch("model_attributes").reverse_merge(
          share_holder_name: user.legal_name,
        )
      )
      common_attrs = {
        equity_buyback_round: company.equity_buyback_rounds.last!,
        company_investor:,
        paid_at: 1.day.ago,
        share_class: share_holding.share_class.name,
        security: share_holding,
      }
      if company_user_data.key?("equity_buybacks")
        company_user_data.fetch("equity_buybacks").each do |equity_buyback_data|
          company.equity_buybacks.create!(common_attrs.merge(equity_buyback_data))
        end
        EquityBuybackPayment.create!(
          {
            equity_buybacks: [company.equity_buybacks.first, company.equity_buybacks.last],
            status: Payment::SUCCEEDED,
            processor_uuid: SecureRandom.uuid,
            processor_name: DividendPayment::PROCESSOR_WISE,
            recipient_last4: "5678",
            wise_credential: WiseCredential.flexile_credential,
          }
        )
      end
      if company_user_data.key?("dividend_attributes")
        dividend_round = company.dividend_rounds.last!
        dividend = company_investor.dividends.create!(
          user_compliance_info:,
          company:,
          dividend_round:,
          paid_at: dividend_round.created_at,
          **company_user_data.fetch("dividend_attributes")
        )
        company_investor.investor_dividend_rounds.create!(dividend_round:)
        DividendPayment.create!(
          dividends: [dividend],
          status: Payment::SUCCEEDED,
          processor_uuid: SecureRandom.uuid,
          processor_name: DividendPayment::PROCESSOR_WISE,
          recipient_last4: "5678",
          wise_credential: WiseCredential.flexile_credential,
        )
      end
      if company_user_data.key?("convertible_securities")
        company_user_data.fetch("convertible_securities").each do |convertible_security_data|
          model_attributes = convertible_security_data.fetch("model_attributes")
          convertible_investment = company.convertible_investments.find_by!(
            **convertible_security_data.fetch("convertible_investment").fetch("model_attributes")
          )
          Timecop.travel(convertible_investment.issued_at) do
            convertible_investment.convertible_securities.create!(
              company_investor: company_investor,
              issued_at: Time.current,
              **model_attributes
            )
          end
          convertible_investment.send(:update_implied_shares_for_securities)
        end
      end
    end

    def generate_user_email(user_attributes)
      email_identifier = user_attributes.dig("preferred_name") || user_attributes.fetch("legal_name").split.first
      generate_email(email_identifier)
    end

    def create_user_compliance_info!(user, attributes)
      user.user_compliance_infos.create!(
        **user.compliance_attributes
          .merge(attributes)
          .reverse_merge(
            tax_information_confirmed_at: user.created_at
          )
      )
    end

    def enable_feature_flags!(company, feature_flags)
      feature_flags.each do |feature_name, enabled|
        if enabled
          Flipper.enable(feature_name.to_sym, company)
        else
          Flipper.disable(feature_name.to_sym, company)
        end
      end
      enabled_flags = feature_flags.select { _1.last }.keys
      disabled_flags = feature_flags.reject { _1.last }.keys

      print_message("Enabled feature flags: #{enabled_flags.join(", ")}") if enabled_flags.any?
      print_message("Disabled feature flags: #{disabled_flags.join(", ")}") if disabled_flags.any?
    end

    def create_expense_categories!(company, categories)
      return unless company.expenses_enabled?

      categories.each do |category|
        company.expense_categories.create!(name: category["name"])
      end
      print_message("Created expense categories: #{categories.map { |c| c["name"] }.join(", ")}")
    end

    def create_company_roles_and_contractors!(company, company_roles_and_contractors_data, company_worker_updates_data)
      company_administrator = company.primary_admin
      company_roles_and_contractors_data.each do |company_role_and_contractor_data|
        company_role = create_company_role_and_applications!(company, company_role_and_contractor_data.fetch("company_role"))
        company_role_and_contractor_data.fetch("company_workers", []).each do |company_worker_data|
          company_worker_attributes = company_worker_data.fetch("company_worker").fetch("model_attributes")
          ended_at = company_worker_attributes.delete("ended_at")
          company_worker = nil
          started_at = fast_mode ? (current_time - rand(1..2).month) : company_worker_attributes.fetch("started_at")
          Timecop.travel(started_at) do
            Timecop.scale(3600) do # 1 second = 1 hour
              # Invite contractor
              user_attributes = company_worker_data.fetch("user_attributes")
              worker_params = {
                email: generate_user_email(user_attributes),
                started_at:,
                pay_rate_in_subunits: company_worker_attributes.fetch("pay_rate_in_subunits"),
                pay_rate_type: company_role.pay_rate_type,
                role_id: company_role.external_id,
                hours_per_week: company_worker_attributes.fetch("hours_per_week", nil),
              }
              result = InviteWorker.new(
                current_user: company_administrator.user,
                company:,
                company_administrator:,
                worker_params:
              ).perform
              company_worker = result[:company_worker]
              # Contractor onboarding
              contractor = company_worker.user
              contractor.update!(password: DEFAULT_PASSWORD)
              contractor.accept_invitation!
              contractor.tos_agreements.create!(ip_address: "127.0.0.1")

              error_message = UpdateUser.new(
                user: contractor,
                update_params: user_attributes.slice("legal_name", "preferred_name", "country_code", "citizenship_country_code")
              ).process
              raise Error, error_message if error_message.present?

              document = contractor.documents.unsigned_contracts.reload.first
              document.signatures.where(user: contractor).update!(signed_at: Time.current)
              user_legal_params = user_attributes.slice("street_address", "city", "state", "zip_code")
              error_message = UpdateUser.new(
                user: contractor,
                update_params: user_legal_params,
                confirm_tax_info: false,
              ).process
              raise Error, error_message if error_message.present?
              if company_worker_data.key?("wise_recipient_attributes")
                create_user_bank_account!(contractor, company_worker_data.fetch("wise_recipient_attributes"))
              end
              print_message("Created #{contractor.email} (#{contractor.bank_accounts.alive.any? ? "onboarded" : "not onboarded"})")

              if OnboardingState::Worker.new(user: contractor.reload, company:).complete?
                contractor.contractor_profile.update!(
                  company_worker_data.fetch(
                    "contractor_profile_attributes",
                    {
                      available_hours_per_week: 1,
                      available_for_hire: false,
                    }
                  )
                )
                create_company_worker_invoices!(company_worker, ended_at:)
                # if company_worker_data.key?("equity_allocation_attributes")
                #   company_worker.equity_allocations.create!(company_worker_data.fetch("equity_allocation_attributes"))
                # end
                updates_random_records_count = company_worker_updates_data.fetch("random_records_metadata").fetch("count")
                create_company_worker_updates!(company_worker, updates_random_records_count)

                create_company_worker_absences!(company_worker)
              end

              if company.expenses_enabled? && company_role.expense_card_enabled? && company_worker_data.key?("expense_card_charge_data")
                result = Stripe::IssueExpenseCardService.new(
                  company_worker:,
                  ip_address: "127.0.0.1",
                  browser_user_agent: "Rails Testing"
                ).process
                if !result[:success]
                  raise Error, "Error creating expense card for #{user.email}: #{result.inspect}"
                end
                expense_card = result[:expense_card]

                expense_card_data = company_worker_data.fetch("expense_card_charge_data")
                count = fast_mode ? FAST_MODE_RANDOM_RECORDS_METADATA_COUNT : expense_card_data.fetch("random_records_metadata").fetch("count")
                start_date = (current_time - count.months).end_of_month
                count.times do |i|
                  current_date = start_date + i.months + rand(1..10).days
                  Timecop.travel(current_date) do
                    amount_in_cents = rand(1000..10000)
                    processor_transaction_reference = "ipi_#{SecureRandom.hex(13)}"
                    expense_card.expense_card_charges.create!(
                      description: "American Airlines",
                      total_amount_in_cents: amount_in_cents,
                      company:,
                      processor_transaction_reference:,
                      processor_transaction_data: {
                        "id" => processor_transaction_reference,
                        "card" => expense_card.processor_reference,
                        "type" => "capture",
                        "amount" => -amount_in_cents,
                        "object" => "issuing.transaction",
                        "wallet" => nil,
                        "created" => Time.current.to_i,
                        "dispute" => nil,
                        "currency" => "usd",
                        "livemode" => false,
                        "metadata" => {},
                        "cardholder" => "ich_1Pdy4jFSsGLfTpetoSTPZEMM",
                        "network_data" => {
                          "transaction_id" => "test_534891418799342",
                          "processing_date" => Date.current,
                          "authorization_code" => "S89606",
                        },
                        "authorization" => nil,
                        "merchant_data" => {
                          "url" => "https://rocketrides.io/",
                          "city" => "San Francisco",
                          "name" => "American Airlines",
                          "state" => "CA",
                          "country" => "US",
                          "category" => "airlines_air_carriers",
                          "network_id" => "1234567890",
                          "postal_code" => "94101",
                          "terminal_id" => "99999999",
                          "category_code" => "4511",
                        },
                        "amount_details" => { "atm_fee" => nil, "cashback_amount" => 0 },
                        "merchant_amount" => -amount_in_cents,
                        "merchant_currency" => "usd",
                        "balance_transaction" => "txn_1PdzvZFSsGLfTpetKe9mLU0V",
                      }
                    )
                  end
                end
              end
              if company_worker_data.key?("equity_grants")
                company_investor = company.company_investors.create!(
                  user: contractor,
                  **company_worker_data.fetch("company_investor_attributes")
                )
                create_equity_grants!(company, company_worker_data, company_investor, company_worker)
                print_message("Created #{company_worker_data.fetch("equity_grants").count} option grants for #{contractor.email}")
              end
            end
          end
          if ended_at
            Timecop.travel(ended_at) do
              company_worker.end_contract!
            end
          end
        end
      end
    end

    def create_company_worker_invoices!(company_worker, ended_at: nil)
      user = company_worker.user
      company = company_worker.company

      invoice_datetime = company_worker.started_at.beginning_of_month
      invoice_count = 0
      while invoice_datetime < current_time - 1.month
        break if ended_at && invoice_datetime >= ended_at

        invoice_line_item = if company_worker.project_based?
          {
            description: "Project work",
            total_amount_cents: company_worker.pay_rate_in_subunits,
          }
        else
          {
            description: "Consulting",
            minutes: company_worker.hours_per_week * 60 * 4 + rand(-30..30),
          }
        end
        params = ActionController::Parameters.new(
          {
            invoice: {
              invoice_number: Invoice.new(user:, company:).recommended_invoice_number,
              invoice_date: invoice_datetime.end_of_month.to_date,
            },
            invoice_line_items: [invoice_line_item],
          },
        )
        Timecop.travel(invoice_datetime) do
          Timecop.scale(3600 * 24) do # 1 second = 1 day
            result = CreateOrUpdateInvoiceService.new(
              params:,
              user:,
              company:,
              contractor: company_worker,
            ).process
            unless result[:success]
              raise Error, "Error creating invoice for #{user.email}: #{error_message}"
            end
            invoice = result[:invoice]
            if rand < 0.1 # 10% chance
              RejectInvoice.new(invoice:, rejected_by: company.primary_admin.user, reason: "Invoice details unclear").perform
            end
          end
        end
        invoice_datetime += 1.month
        invoice_count += 1
      end
      print_message("Created #{invoice_count} #{'invoice'.pluralize(invoice_count)} for #{user.email}.")
    end

    def create_company_worker_updates!(company_worker, count)
      count.times do |i|
        period = CompanyWorkerUpdatePeriod.new(date: (current_time - (i + 1).weeks))
        Timecop.travel(period.ends_on) do
          update = company_worker.company_worker_updates.create!(
            period_starts_on: period.starts_on,
            period_ends_on: period.ends_on,
            published_at: Time.current,
          )
          (1..rand(1..4)).map do |position|
            update.company_worker_update_tasks.create!(
              name: "#{Faker::Company.bs.capitalize} #{Faker::Company.buzzword.downcase}",
              completed_at: [nil, Time.current].sample,
              position:
            )
          end
        end
      end
      print_message("Created #{count} updates for #{company_worker.user.email}.")
    end

    def create_company_worker_absences!(company_worker)
      starts_on = current_time - rand(2..6).weeks
      ends_on = starts_on + rand(0..14).days
      rand(0..3).times do
        notes = [nil, "Mostly AFK", "On vacation with limited WiFi", "Paternity leave"].sample
        company_worker.company_worker_absences.create!(starts_on:, ends_on:, notes:)
        starts_on = ends_on + rand(7..21).days
        ends_on = starts_on + rand(0..14).days
      end
    end

    def create_consolidated_invoices!(company)
      company.invoices.group_by { |invoice| invoice.invoice_date.beginning_of_month }.each do |date, invoices|
        next unless date < current_time - 2.months

        date = date + rand(1..3).days
        Timecop.travel(date) do
          print_message("Creating consolidated invoice for #{date}")
          consolidated_invoice = ApproveAndPayOrChargeForInvoices.new(
            user: company.primary_admin.user,
            company:,
            invoice_ids: invoices.map(&:external_id),
          ).perform
          perform_with_retries do
            consolidated_invoice.consolidated_payments.each do |consolidated_payment|
              ProcessPaymentIntentForConsolidatedPaymentJob.perform_inline(consolidated_payment.id)
              # Override trigger_payout_after that is set via a Stripe charge to a future timestamp, so that we can
              # simulate the payout being sent immediately
              if consolidated_payment.reload.trigger_payout_after.present?
                consolidated_payment.update!(trigger_payout_after: Time.current)
              end
            end
          end
          consolidated_invoice.reload.invoices.each do |invoice|
            invoice.payments.each do |payment|
              # Simulates WiseTransferUpdateJob
              transfer_id = payment.wise_transfer_id
              next unless transfer_id.present?
              api_service = Wise::PayoutApi.new(wise_credential: payment.wise_credential)
              api_service.get_transfer(transfer_id:)
              api_service.simulate_transfer_funds_converted(transfer_id:)
              api_service.simulate_transfer_outgoing_payment_sent(transfer_id:)
              amount = api_service.get_transfer(transfer_id:)["targetValue"]
              estimate = Time.zone.parse(api_service.delivery_estimate(transfer_id:)["estimatedDeliveryDate"])
              payment.update!(status: Payment::SUCCEEDED, wise_transfer_amount: amount, wise_transfer_estimate: estimate)
              invoice.mark_as_paid!(timestamp: (date.end_of_month + rand(1..5).days), payment_id: payment.id)
            end
          end
          consolidated_invoice.reload.consolidated_payments.each do |consolidated_payment|
            next unless consolidated_payment.status == ConsolidatedPayment::SUCCEEDED

            CreatePayoutForConsolidatedPayment.new(consolidated_payment).perform!
            perform_with_retries do
              ProcessPayoutForConsolidatedPaymentJob.perform_inline(consolidated_payment.id)
            end
          end
        end
      end
      print_message("Created consolidated invoices.")
    end

    def create_company_role_and_applications!(company, data)
      company_role = company.company_roles.build(data.fetch("model_attributes"))
      company_role.build_rate(data.fetch("company_role_rate").fetch("model_attributes"))
      company_role.save!
      print_message("Created #{company_role.pay_rate_type} #{company_role.name} role.")
      if data.key?("company_role_applications")
        create_company_role_applications!(company_role, data.fetch("company_role_applications"))
        print_message("Created role applications for #{company_role.name} role.")
      end
      company_role
    end

    def create_company_role_applications!(company_role, data)
      if data.key?("records")
        data.fetch("records").each do |record|
          model_attributes = record.fetch("model_attributes")
          company_role.company_role_applications.create!(
            model_attributes.reverse_merge(
              email: generate_email(model_attributes.fetch("name")),
            )
          )
        end
      end
    end

    def create_company_worker_equity_grant!(company_worker, equity_grant_data)
      option_pool_created_at = Date.new(equity_grant_data.fetch("option_pool").fetch("year"), 1, 1)
      Timecop.travel(option_pool_created_at) do
        GrantStockOptions.new(
          company_worker,
          board_approval_date: option_pool_created_at,
        ).process
        CreateOrUpdateEquityAllocation.new(
          company_worker,
          equity_percentage: equity_grant_data.fetch("equity_allocation").fetch("equity_percentage")
        ).perform!
      end
    end

    def create_user_bank_account!(user, wise_recipient_params)
      wise_recipient_params["details"]["accountHolderName"] ||= user.legal_name
      wise_recipient_params["details"]["address"] ||= {}
      wise_recipient_params["details"]["address"]["country"] ||= user.country_code
      wise_recipient_params["details"]["address"]["city"] ||= user.city
      wise_recipient_params["details"]["address"]["firstLine"] ||= user.street_address
      case wise_recipient_params["type"]
      when "aba"
        wise_recipient_params["details"]["accountNumber"] ||= rand(10000000..99999999).to_s
        wise_recipient_params["details"]["address"]["state"] ||= user.state
        wise_recipient_params["details"]["address"]["postCode"] ||= user.zip_code
      when "emirates"
        wise_recipient_params["details"]["IBAN"] ||= "AE07 0331 2345 6789 0123 456"
      when "iban"
        wise_recipient_params["details"]["IBAN"] ||= "AE07 0331 2345 6789 0123 456"
        wise_recipient_params["details"]["address"]["postCode"] ||= user.zip_code
      when "argentina"
        wise_recipient_params["details"]["accountNumber"] ||= "017 0099 2 2000006779737 0"
        wise_recipient_params["details"]["taxId"] ||= "20-08490848-8"
        wise_recipient_params["details"]["address"]["postCode"] ||= user.zip_code
      else
        raise Error, "Unsupported recipient type: #{wise_recipient_params["type"]}"
      end

      result = Recipient::CreateService.new(user:, params: wise_recipient_params).process
      if !result[:success]
        raise Error, "Error creating bank account for #{user.email}: #{result.inspect}"
      end
    end

    def create_equity_grants!(company, company_worker_data, company_investor, company_worker)
      company_worker_data.fetch("equity_grants").each do |equity_grant_data|
        year = equity_grant_data.fetch("year")
        period_started_at = Date.new(year, 1, 1)
        period_ended_at = period_started_at.end_of_year
        option_pool_created_at = Date.new(equity_grant_data.fetch("option_pool").fetch("year"), 1, 1)
        option_pool = company.option_pools.find_by!(created_at: option_pool_created_at..option_pool_created_at.end_of_year)
        result = EquityGrantCreation.new(
          company_investor:,
          option_pool:,
          option_grant_type: equity_grant_data.fetch("option_grant_type"),
          share_price_usd: equity_grant_data.fetch("share_price_usd"),
          exercise_price_usd: equity_grant_data.fetch("exercise_price_usd"),
          number_of_shares: equity_grant_data.fetch("number_of_shares"),
          vested_shares: equity_grant_data.fetch("vested_shares"),
          period_started_at:,
          period_ended_at:,
          board_approval_date: equity_grant_data.fetch("board_approval_date"),
          issue_date_relationship: equity_grant_data.fetch("issue_date_relationship"),
          vesting_trigger: "invoice_paid",
          vesting_schedule: nil,
          voluntary_termination_exercise_months: equity_grant_data.fetch("voluntary_termination_exercise_months", nil),
          involuntary_termination_exercise_months: equity_grant_data.fetch("involuntary_termination_exercise_months", nil),
          termination_with_cause_exercise_months: equity_grant_data.fetch("termination_with_cause_exercise_months", nil),
          death_exercise_months: equity_grant_data.fetch("death_exercise_months", nil),
          disability_exercise_months: equity_grant_data.fetch("disability_exercise_months", nil),
          retirement_exercise_months: equity_grant_data.fetch("retirement_exercise_months", nil),
        ).process
        result.equity_grant.update!(equity_grant_data.fetch("model_attributes"))

        if equity_grant_data.key?("equity_grant_exercise")
          EquityExercisingService.create_request(
            equity_grants_params: [
              {
                id: result.equity_grant.id,
                number_of_options: equity_grant_data.fetch("equity_grant_exercise").fetch("model_attributes").fetch("number_of_options"),
              }
            ],
            company_investor:,
            company_worker:,
            submission_id: "submission"
          )
        end
      end
    end

    def generate_email(identifier)
      identifier = identifier.downcase.gsub(/[^a-z0-9]+/, "_")
      username, domain = config.fetch("email").split("@")
      "#{username}+#{identifier}@#{domain}"
    end

    def perform_with_retries
      retries = 0
      begin
        yield
      rescue => e
        Rails.logger.error("⚠️ perform_with_retries (#{retries}): #{e.message}")
        if (retries += 1) <= 6
          print_message(".", on_new_line: false)
          sleep(2**retries) # Exponential backoff
          retry
        else
          raise e
        end
      end
    end

    def top_up_wise_account_if_needed
      amount_required = WiseTopUpReminderJob::SIMULATED_TOP_UP_AMOUNT
      return if Wise::AccountBalance.refresh_flexile_balance > amount_required

      Wise::AccountBalance.simulate_top_up_usd_balance(amount: amount_required)
      print_message("Topped up Wise account.")
    end

    def print_message(message, on_new_line: true)
      line_separator = on_new_line ? "\n" : ""

      $stdout.print(line_separator + message)
    end

    def create_temporary_zip_file
      temp_file = Tempfile.new(["sample", ".zip"])

      Zip::OutputStream.open(temp_file) { |zos| }

      Zip::File.open(temp_file.path, Zip::File::CREATE) do |zipfile|
        zipfile.get_output_stream("sample.txt") { |f| f.write "This is a sample file in the zip." }
      end

      File.open(temp_file.path)
    ensure
      temp_file.close
      temp_file.unlink
    end

    def create_temporary_pdf_file
      temp_file = Tempfile.new(["sample", ".pdf"])

      Prawn::Document.generate(temp_file.path) do
        text "This is a sample PDF file created for testing purposes."
        text "Generated at: #{Time.current}"
      end

      temp_file.close
      temp_file.open # Reopen in read mode
      temp_file
    end
end
