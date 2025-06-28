# frozen_string_literal: true

class OnboardingState::User
  include Rails.application.routes.url_helpers
  attr_reader :user, :company

  def initialize(user:, company:)
    @user = user
    @company = company
  end

  def redirect_path
    if user.company_administrator_for?(company)
      OnboardingState::Company.new(company).redirect_path
    elsif user.company_lawyer_for?(company)
      OnboardingState::Lawyer.new(user:, company:).redirect_path
    elsif user.company_worker_for?(company)
      OnboardingState::Worker.new(user:, company:).redirect_path
    elsif user.company_investor_for?(company)
      OnboardingState::Investor.new(user:, company:).redirect_path
    else
      # User has no company roles - create a company and make them administrator
      create_company_for_user
      "/people"
    end
  end

  private
    def create_company_for_user
      ApplicationRecord.transaction do
        company = Company.create!(
          email: user.email,
          country_code: user.country_code || "US",
          default_currency: "USD"
        )
        user.company_administrators.create!(company: company)
        company
      end
    end
end
