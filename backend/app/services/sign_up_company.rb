# frozen_string_literal: true

class SignUpCompany
  # Flexile is currently available only to companies incorporated in the United States.
  US_COUNTRY_CODE = "US"
  DEFAULT_CURRENCY = "USD"

  def initialize(user_attributes:, ip_address:)
    @user_attributes = user_attributes
    @ip_address = ip_address
  end

  def perform
    ApplicationRecord.transaction do
      result = SignUpUser.new(user_attributes: user_attributes.merge(country_code: US_COUNTRY_CODE), ip_address:).perform
      return result unless result[:success]

      user = result[:user]
      company = Company.create!(email: user.email, country_code: US_COUNTRY_CODE, default_currency: DEFAULT_CURRENCY)
      user.company_administrators.create!(company:)
      { success: true, user: }
    end
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    attr_reader :user_attributes, :ip_address
end
