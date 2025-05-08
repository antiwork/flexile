# frozen_string_literal: true

require "administrate/base_dashboard"

class InvoiceDashboard < Administrate::BaseDashboard
  # ATTRIBUTE_TYPES
  # a hash that describes the type of each of the model's fields.
  #
  # Each different type represents an Administrate::Field object,
  # which determines how the attribute is displayed
  # on pages throughout the dashboard.
  ATTRIBUTE_TYPES = {
    versions: Field::HasMany,
    company: Field::BelongsTo,
    user: Field::BelongsTo,
    invoice_line_items: Field::HasMany,
    payments: Field::HasMany,
    attachments_attachments: Field::HasMany,
    attachments_blobs: Field::HasMany,
    id: Field::Number,
    invoice_date: Field::Date,
    total_minutes: Field::Number,
    total_amount_in_usd_cents: Field::Number,
    status: Field::String,
    created_at: Field::DateTime,
    updated_at: Field::DateTime,
    invoice_number: Field::String,
    description: Field::String,
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
    user
    total_amount_in_usd_cents
    status
  ].freeze

  # SHOW_PAGE_ATTRIBUTES
  # an array of attributes that will be displayed on the model's show page.
  SHOW_PAGE_ATTRIBUTES = %i[
    company
    user
    payments
    id
    invoice_date
    total_minutes
    total_amount_in_usd_cents
    status
    created_at
    updated_at
    invoice_number
    description
  ].freeze

  # FORM_ATTRIBUTES
  # an array of attributes that will be displayed
  # on the model's form (`new` and `edit`) pages.
  FORM_ATTRIBUTES = %i[
    company
    user
    payments
    invoice_date
    total_minutes
    total_amount_in_usd_cents
    status
    invoice_number
    description
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

  # Overwrite this method to customize how invoices are displayed
  # across all pages of the admin dashboard.
  #
  # def display_resource(invoice)
  #   "Invoice ##{invoice.id}"
  # end
end
