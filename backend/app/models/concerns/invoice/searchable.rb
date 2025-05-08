# frozen_string_literal: true

module Invoice::Searchable
  extend ActiveSupport::Concern

  included do
    include PgSearch::Model

    delegate :email, :legal_name, :preferred_name, :business_name,
             :billing_entity_name, to: :user, prefix: true, private: true

    multisearchable against: [:invoice_number, :invoice_month, :invoice_year, :payment_ids, :description,
                              :notes, :bill_from, :total_amount_in_usd, :user_email, :user_legal_name,
                              :user_preferred_name, :user_business_name, :user_billing_entity_name],
                    additional_attributes: -> (invoice) { { company_id: invoice.company_id } }
  end

  private
    def invoice_year
      invoice_date.year
    end

    def invoice_month
      Date::MONTHNAMES[invoice_date.month]
    end

    def payment_ids
      payments.pluck(:wise_transfer_id).join(" ")
    end
end
