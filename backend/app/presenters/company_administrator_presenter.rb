# frozen_string_literal: true

class CompanyAdministratorPresenter
  include Rails.application.routes.url_helpers

  delegate :invitation_token, :email, :legal_name, to: :user, allow_nil: true
  delegate :name, :street_address, :city, :state, :zip_code, :display_country, :quickbooks_enabled?,
           :domain_name, :logo_url, :brand_color, :website,
           :display_name, :phone_number, :tax_id, to: :company, allow_nil: true

  def initialize(company_administrator)
    @user = company_administrator.user
    @company = company_administrator.company
  end

  def company_onboarding_props
    data = company_data_from_clearbit
    iso_country = ISO3166::Country[:US]

    {
      company: {
        name: name || data.dig("name"),
        street_address: street_address || data.dig("geo", "streetAddress"),
        city: city || data.dig("geo", "city"),
        state: state || iso_country.find_subdivision_by_name(data.dig("geo", "state"))&.code,
        zip_code: zip_code || data.dig("geo", "postalCode"),
      },
      states: iso_country.subdivision_names_with_codes.sort,
      legal_name:,
      on_success_redirect_path: OnboardingState::Company.new(company).redirect_path_after_onboarding_details_success,
    }
  end

  private
    attr_reader :user, :company

    COMMON_PUBLIC_EMAIL_DOMAINS = %w(gmail.com yahoo.com hotmail.com).freeze
    private_constant :COMMON_PUBLIC_EMAIL_DOMAINS

    def company_data_from_clearbit
      # Don't pull data for common/public domains as that data won't be about the user's company
      return {} if !Clearbit.key || COMMON_PUBLIC_EMAIL_DOMAINS.include?(domain_name.downcase)

      (Clearbit::Enrichment::Company.find(domain: domain_name, stream: true) || {}) rescue {}
    end
end
