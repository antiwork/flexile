# frozen_string_literal: true

module User::Searchable
  extend ActiveSupport::Concern

  included do
    include PgSearch::Model

    delegate :display_name, to: :user
    delegate :email, :legal_name, :preferred_name, :business_name, :billing_entity_name,
             to: :user, prefix: true, private: true

    multisearchable against: [:user_email, :user_legal_name, :user_preferred_name, :user_business_name],
                    additional_attributes: -> (object) { { company_id: object.company_id } }
  end
end
