# frozen_string_literal: true

require "administrate/base_dashboard"

class UserLeadDashboard < Administrate::BaseDashboard
  ATTRIBUTE_TYPES = {
    id: Field::Number,
    email: Field::String,
    wise_api_key: Field::String.with_options(searchable: false),
    company_name: Field::String.with_options(searchable: false),
    company_logo_url: Field::String.with_options(searchable: false),
    registration_number: Field::String.with_options(searchable: false),
    created_at: Field::DateTime,
    updated_at: Field::DateTime,
  }.freeze

  FORM_ATTRIBUTES = %i[
    email
  ].freeze

  COLLECTION_ATTRIBUTES = %i[
    id
    email
  ].freeze

  SHOW_PAGE_ATTRIBUTES = %i[
    id
    email
    created_at
    updated_at
  ].freeze

  COLLECTION_FILTERS = {}.freeze
end
