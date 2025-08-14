# frozen_string_literal: true

class CompleteUserSetup
  def initialize(user:, ip_address:)
    @user = user
    @ip_address = ip_address
  end

  def perform
    user.tos_agreements.create!(ip_address: ip_address)

    unless user.signup_invite_link
      company = Company.create!(
        email: user.email,
        country_code: "US",
        default_currency: "USD"
      )
      user.company_administrators.create!(company: company)
    end
  end

  private
    attr_reader :user, :ip_address
end
