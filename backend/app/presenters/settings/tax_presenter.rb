# frozen_string_literal: true

class Settings::TaxPresenter
  delegate :birth_date, :business_entity?, :business_name, :city, :citizenship_country_code, :country_code, :display_name,
           :legal_name, :requires_w9?, :signature, :state, :street_address, :tax_id, :business_type, :tax_classification,
           :tax_information_confirmed_at, :tax_id_status, :zip_code, private: true, to: :user

  def initialize(user:)
    @user = user
  end

  def props
    {
      birth_date: birth_date&.to_s,
      business_name:,
      citizenship_country_code:,
      country_code:,
      city:,
      display_name:,
      business_entity: business_entity?,
      business_type: UserComplianceInfo.business_types[business_type],
      tax_classification: UserComplianceInfo.tax_classifications[tax_classification],
      is_foreign: !requires_w9?,
      is_tax_information_confirmed: tax_information_confirmed_at.present?,
      legal_name:,
      signature:,
      state:,
      street_address:,
      tax_id:,
      tax_id_status:,
      zip_code:,
      contractor_for_companies: user.company_workers.includes(:company).where(contract_signed_elsewhere: false).filter_map(&:company).filter_map(&:display_name),
    }
  end

  private
    attr_reader :user
end
