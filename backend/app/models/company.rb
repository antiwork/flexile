# frozen_string_literal: true

class Company < ApplicationRecord
  has_paper_trail

  # Must match the value set in application.ts
  PLACEHOLDER_COMPANY_ID = "_"

  include Flipper::Identifier, ExternalId

  normalizes :tax_id, with: -> { _1.delete("^0-9") }
  normalizes :phone_number, with: -> { _1.delete("^0-9").delete_prefix("1") }

  US_STATE_CODES = ISO3166::Country[:US].subdivisions.keys

  # Do not change the order of these roles until users can switch roles
  # It will affect which company a user can access by default
  ACCESS_ROLES = {
    worker: CompanyWorker,
    administrator: CompanyAdministrator,
    lawyer: CompanyLawyer,
    investor: CompanyInvestor,
  }.freeze

  ACCESS_ROLES.keys.each do |access_role|
    self.const_set("ACCESS_ROLE_#{access_role.upcase}", access_role)
  end

  ADMIN_CHECKLIST_ITEMS = [
    { key: "add_company_details", title: "Add company details", description: "Add your company name and basic information" },
    { key: "add_bank_account", title: "Add bank account", description: "Connect your bank account to enable payments" },
    { key: "invite_contractor", title: "Invite a contractor", description: "Add your first team member" },
    { key: "send_first_payment", title: "Send your first payment", description: "Process your first contractor payment" }
  ].freeze

  WORKER_CHECKLIST_ITEMS = [
    { key: "fill_tax_information", title: "Fill tax information", description: "Complete your tax details" },
    { key: "add_payout_information", title: "Add payout information", description: "Set up your payment method" },
    { key: "sign_contract", title: "Sign contract", description: "Review and sign your contractor agreement" }
  ].freeze

  has_many :company_administrators
  has_many :administrators, through: :company_administrators, source: :user
  has_many :company_lawyers
  has_many :lawyers, through: :company_lawyers, source: :user
  has_one :primary_admin, -> { order(id: :asc) }, class_name: "CompanyAdministrator"
  has_many :company_workers
  has_many :company_investor_entities
  has_many :contracts
  has_many :contractors, through: :company_workers, source: :user do
    def active
      merge(CompanyWorker.active)
    end
  end
  has_many :company_investors
  has_many :company_invite_links, dependent: :destroy # dependent: :destroy is needed to clean up invite links when a company is deleted

  has_many :investors, through: :company_investors, source: :user
  has_many :company_updates
  has_many :documents
  has_many :dividends
  has_many :dividend_computations
  has_many :dividend_rounds
  has_many :equity_buybacks
  has_many :equity_buyback_rounds
  has_many :equity_grants, through: :company_investors
  has_many :equity_grant_exercises
  has_many :time_entries
  has_many :convertible_investments
  has_many :consolidated_invoices
  has_many :invoices
  has_many :expense_categories
  has_many :consolidated_payment_balance_transactions
  has_many :balance_transactions
  has_one :balance
  has_one :equity_exercise_bank_account, -> { order(id: :desc) }
  has_one :quickbooks_integration, -> { alive }
  has_many :share_classes
  has_many :share_holdings, through: :company_investors
  has_many :option_pools
  has_many :tender_offers
  has_many :company_stripe_accounts
  has_many :bank_accounts, class_name: "CompanyStripeAccount"
  has_one :bank_account, -> { alive.order(created_at: :desc) }, class_name: "CompanyStripeAccount"
  has_one_attached :logo, service: (Rails.env.test? ? :test_public : :amazon_public)
  has_one_attached :full_logo

  validates :name, presence: true, on: :update, if: :name_changed?
  validates :email, presence: true
  validates :country_code, presence: true
  validates :required_invoice_approval_count, presence: true,
                                              numericality: { only_integer: true, greater_than: 0 }
  validates :street_address, presence: true, on: :update, if: :street_address_changed?
  validates :city, presence: true, on: :update, if: :city_changed?
  validates :state, presence: true, inclusion: US_STATE_CODES, on: :update, if: :state_changed?
  validates :registration_state, inclusion: US_STATE_CODES, allow_nil: true
  validates :zip_code, presence: true, zip_code: true, on: :update, if: :zip_code_changed?
  validates :phone_number, length: { is: 10 }, allow_blank: true, if: :phone_number_changed?
  validates :valuation_in_dollars, presence: true,
                                   numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :fully_diluted_shares, presence: true,
                                   numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :share_price_in_usd, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :fmv_per_share_in_usd, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :brand_color, hex_color: true, if: :brand_color_changed?

  scope :active, -> { where(deactivated_at: nil) }
  scope :is_gumroad, -> { where(is_gumroad: true) }
  scope :is_trusted, -> { where(is_trusted: true) }

  after_create_commit :create_balance!
  after_update_commit :update_convertible_implied_shares, if: :saved_change_to_fully_diluted_shares?

  accepts_nested_attributes_for :expense_categories

  delegate :stripe_setup_intent, :bank_account_last_four, :microdeposit_verification_required?,
           :microdeposit_verification_details, to: :bank_account, allow_nil: true

  def deactivate! = update!(deactivated_at: Time.current)

  def active? = deactivated_at.nil?

  def logo_url
    return logo.url if logo.attached?

    ActionController::Base.helpers.asset_path("default-company-logo.svg")
  end

  def account_balance
    balance.amount_cents / 100.0
  end

  def display_name
    public_name.presence || name
  end

  def display_country
    ISO3166::Country[country_code].common_name
  end

  def account_balance_low?
    account_balance < (pending_invoice_cash_amount_in_cents / 100.0 + Balance::REQUIRED_BALANCE_BUFFER_IN_USD)
  end

  def has_sufficient_balance?(usd_amount)
    return false unless Wise::AccountBalance.has_sufficient_flexile_balance?(usd_amount)
    account_balance >= (is_trusted? ? 0 : usd_amount)
  end

  def pending_invoice_cash_amount_in_cents = invoices.alive.pending.sum(:cash_amount_in_cents)

  def create_stripe_setup_intent
    Stripe::SetupIntent.create({
      customer: fetch_or_create_stripe_customer_id!,
      payment_method_types: ["us_bank_account"],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ["payment_method"],
          },
        },
      },
      expand: ["payment_method"],
    })
  end

  def stripe_setup_intent_id = bank_account&.setup_intent_id

  def bank_account_added? = !!bank_account&.initial_setup_completed?

  def bank_account_ready? = !!bank_account&.ready?

  def contractor_payment_processing_time_in_days
    is_trusted? ? 2 : 10 # estimated max number of business days for a contractor to receive payment after a consolidated invoice is charged
  end

  def quickbooks_enabled?
    Flipper.enabled?(:quickbooks, self)
  end

  def expenses_enabled?
    Flipper.enabled?(:expenses, self)
  end

  def find_company_worker!(user:)
    company_workers.find_by!(user:)
  end

  def find_company_administrator!(user:)
    company_administrators.find_by!(user:)
  end

  def find_company_lawyer!(user:)
    company_lawyers.find_by!(user:)
  end

  def domain_name
    email.split("@").last
  end

  def json_flag?(flag)
    json_data&.dig("flags")&.include?(flag)
  end

  def checklist_items(user)
    case user
    when CompanyAdministrator
      ADMIN_CHECKLIST_ITEMS.map do |item|
        item.merge(completed: checklist_item_completed?(item[:key], user))
      end
    when CompanyWorker
      WORKER_CHECKLIST_ITEMS.map do |item|
        item.merge(completed: checklist_item_completed?(item[:key], user))
      end
    else
      []
    end
  end

  def checklist_completion_percentage(user)
    completed_count = checklist_items(user).count { |item| item[:completed] }
    return 0 if checklist_items(user).empty?

    (completed_count.to_f / checklist_items(user).size * 100).round
  end

  private
    def update_convertible_implied_shares
      convertible_investments.each do |investment|
        conversion_price = (investment.company_valuation_in_dollars.to_d / fully_diluted_shares.to_d).round(4)
        investment.update!(implied_shares: ((investment.amount_in_cents.to_d / 100.to_d) / conversion_price).floor)
      end
    end

    def fetch_or_create_stripe_customer_id!
      return stripe_customer_id if stripe_customer_id?

      stripe_customer = Stripe::Customer.create(
        name: display_name,
        email: email,
        metadata: {
          external_id: external_id,
        }
      )
      update!(stripe_customer_id: stripe_customer.id)
      stripe_customer_id
    end

    def checklist_item_completed?(key, user)
      case key
      when "add_company_details"
        name.present?
      when "add_bank_account"
        bank_account_ready?
      when "invite_contractor"
        company_workers.active.exists?
      when "send_first_payment"
        invoices.where(status: Invoice::PAID_OR_PAYING_STATES).exists?
      when "fill_tax_information"
        user.user.compliance_info&.tax_information_confirmed_at.present?
      when "add_payout_information"
        user.user.bank_account.present?
      when "sign_contract"
        user.contract_signed?
      else
        false
      end
    end
end
