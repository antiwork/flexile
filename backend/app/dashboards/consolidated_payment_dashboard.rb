# frozen_string_literal: true

require "administrate/base_dashboard"

class ConsolidatedPaymentDashboard < Administrate::BaseDashboard
  # ATTRIBUTE_TYPES
  # a hash that describes the type of each of the model's fields.
  #
  # Each different type represents an Administrate::Field object,
  # which determines how the attribute is displayed
  # on pages throughout the dashboard.
  ATTRIBUTE_TYPES = {
    id: Field::Number,
    balance_transactions: Field::HasMany,
    bank_account_last_four: Field::String,
    consolidated_invoice: Field::BelongsTo,
    integration_records: Field::HasMany,
    quickbooks_integration_record: Field::HasOne,
    status: Field::String,
    stripe_fee_cents: Field::Number,
    stripe_payment_intent_id: StripePaymentIntentIdField,
    stripe_payout_id: Field::String,
    stripe_transaction_id: Field::String,
    succeeded_at: Field::DateTime,
    trigger_payout_after: Field::DateTime,
    versions: Field::HasMany,
    created_at: Field::DateTime,
    updated_at: Field::DateTime,
  }.freeze

  # COLLECTION_ATTRIBUTES
  # an array of attributes that will be displayed on the model's index page.
  #
  # By default, it's limited to four items to reduce clutter on index pages.
  # Feel free to add, remove, or rearrange items.
  COLLECTION_ATTRIBUTES = %i[
    id
    consolidated_invoice
    status
    stripe_payment_intent_id
    created_at
  ].freeze

  # SHOW_PAGE_ATTRIBUTES
  # an array of attributes that will be displayed on the model's show page.
  SHOW_PAGE_ATTRIBUTES = %i[
    id
    status
    consolidated_invoice
    stripe_fee_cents
    stripe_payment_intent_id
    stripe_payout_id
    stripe_transaction_id
    succeeded_at
    trigger_payout_after
    created_at
    updated_at
  ].freeze

  # FORM_ATTRIBUTES
  # an array of attributes that will be displayed
  # on the model's form (`new` and `edit`) pages.
  FORM_ATTRIBUTES = %i[
  ].freeze

  # COLLECTION_FILTERS
  # a hash that defines filters that can be used while searching via the search
  # field of the dashboard.
  #
  # For example to add an option to search for open resources by typing "open:"
  # in the search field:
  #
  #   COLLECTION_FILTERS = {
  #     open: ->(resources) { resources.where(open: true) }
  #   }.freeze
  COLLECTION_FILTERS = {}.freeze

  # Overwrite this method to customize how consolidated payments are displayed
  # across all pages of the admin dashboard.
  #
  # def display_resource(consolidated_payment)
  #   "ConsolidatedPayment ##{consolidated_payment.id}"
  # end
end
