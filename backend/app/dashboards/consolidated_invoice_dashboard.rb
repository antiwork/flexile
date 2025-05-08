# frozen_string_literal: true

require "administrate/base_dashboard"

class ConsolidatedInvoiceDashboard < Administrate::BaseDashboard
  # ATTRIBUTE_TYPES
  # a hash that describes the type of each of the model's fields.
  #
  # Each different type represents an Administrate::Field object,
  # which determines how the attribute is displayed
  # on pages throughout the dashboard.
  ATTRIBUTE_TYPES = {
    id: Field::Number,
    company: Field::BelongsTo,
    consolidated_invoices_invoices: Field::HasMany,
    consolidated_payments: Field::HasMany,
    integration_records: Field::HasMany,
    invoice_amount_cents: Field::Number,
    invoice_date: Field::Date,
    invoice_number: Field::String,
    invoices: Field::HasMany,
    paid_at: Field::DateTime,
    period_end_date: Field::Date,
    period_start_date: Field::Date,
    quickbooks_integration_record: Field::HasOne,
    quickbooks_journal_entry: Field::HasOne,
    receipt_attachment: Field::HasOne,
    receipt_blob: Field::HasOne,
    flexile_fee_cents: Field::Number,
    status: Field::String,
    successful_payment: Field::HasOne,
    total_cents: Field::Number,
    transfer_fee_cents: Field::Number,
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
    invoice_number
    company
    total_cents
    status
  ].freeze

  # SHOW_PAGE_ATTRIBUTES
  # an array of attributes that will be displayed on the model's show page.
  SHOW_PAGE_ATTRIBUTES = %i[
    id
    invoice_number
    company
    total_cents
    status
    invoice_amount_cents
    flexile_fee_cents
    transfer_fee_cents
    invoice_date
    invoices
    period_end_date
    period_start_date
    consolidated_payments
    successful_payment
    paid_at
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

  # Overwrite this method to customize how consolidated invoices are displayed
  # across all pages of the admin dashboard.
  #
  # def display_resource(consolidated_invoice)
  #   "ConsolidatedInvoice ##{consolidated_invoice.id}"
  # end
end
