# frozen_string_literal: true

require "administrate/base_dashboard"

class CompanyDashboard < Administrate::BaseDashboard
  # ATTRIBUTE_TYPES
  # a hash that describes the type of each of the model's fields.
  #
  # Each different type represents an Administrate::Field object,
  # which determines how the attribute is displayed
  # on pages throughout the dashboard.
  ATTRIBUTE_TYPES = {
    company_administrators: Field::HasMany,
    administrators: Field::HasMany,
    company_lawyers: Field::HasMany,
    lawyers: Field::HasMany,
    company_workers: Field::HasMany,
    contractors: Field::HasMany,
    time_entries: Field::HasMany,
    id: Field::Number,
    name: Field::String,
    email: Field::String,
    registration_number: Field::String,
    street_address: Field::String,
    city: Field::String,
    state: Field::String,
    zip_code: Field::String,
    country_code: Field::String,
    bank_account_added?: Field::Boolean,
    bank_account_ready?: Field::Boolean,
    is_trusted: Field::Boolean,
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
    name
    email
    is_trusted
    administrators
    lawyers
    contractors
  ].freeze

  # SHOW_PAGE_ATTRIBUTES
  # an array of attributes that will be displayed on the model's show page.
  SHOW_PAGE_ATTRIBUTES = %i[
    id
    name
    email
    registration_number
    street_address
    city
    state
    zip_code
    country_code
    is_trusted
    bank_account_added?
    bank_account_ready?
    created_at
    updated_at
  ].freeze

  # FORM_ATTRIBUTES
  # an array of attributes that will be displayed
  # on the model's form (`new` and `edit`) pages.
  FORM_ATTRIBUTES = %i[
    name
    email
    registration_number
    street_address
    city
    state
    zip_code
    country_code
    is_trusted
    bank_account_added?
    bank_account_ready?
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

  # Overwrite this method to customize how companies are displayed
  # across all pages of the admin dashboard.
  #
  # def display_resource(company)
  #   "Company ##{company.id}"
  # end
end
