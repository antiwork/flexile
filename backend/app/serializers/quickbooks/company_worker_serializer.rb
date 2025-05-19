# frozen_string_literal: true

class Quickbooks::CompanyWorkerSerializer < BaseSerializer
  delegate :user, :pay_rate_in_subunits, :ended_at, :integration_external_id, :sync_token, to: :object
  delegate :legal_name, :billing_entity_name, :display_email, :tax_id, :business_name,
           :city, :street_address, :zip_code, :state, :display_country, to: :user

  def attributes
    result = {
      Active: true,
      BillAddr: {
        City: city,
        Line1: street_address,
        PostalCode: zip_code,
        Country: display_country,
        CountrySubDivisionCode: state,
      },
      BillRate: pay_rate_in_subunits / 100.0,
      GivenName: legal_name,
      DisplayName: billing_entity_name,
      PrimaryEmailAddr: { Address: display_email },
      Vendor1099: false,
    }
    result[:Id] = integration_external_id if integration_external_id.present?
    result[:SyncToken] = sync_token if sync_token.present?
    result[:TaxIdentifier] = tax_id if tax_id.present?
    result[:CompanyName] = business_name if business_name.present?
    result
  end
end
