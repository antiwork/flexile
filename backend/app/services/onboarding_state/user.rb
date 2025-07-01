# frozen_string_literal: true

class OnboardingState::User
  include Rails.application.routes.url_helpers
  attr_reader :user, :company

  def initialize(user:, company:)
    @user = user
    @company = company
  end

  def redirect_path
    if user.company_lawyer_for?(company)
      OnboardingState::Lawyer.new(user:, company:).redirect_path
    elsif user.company_worker_for?(company)
      OnboardingState::Worker.new(user:, company:).redirect_path
    elsif user.company_investor_for?(company)
      OnboardingState::Investor.new(user:, company:).redirect_path
    elsif user.company_worker_invitation_for?(company)
      accept_result = accept_company_invite_link
      return OnboardingState::Worker.new(user:, company:).redirect_path if accept_result[:success]
      "/invite/#{user.signup_invite_link.token}"
    else
      nil
    end
  end

  private
    def accept_company_invite_link
      AcceptCompanyInviteLink.new(user:, token: user.signup_invite_link.token).perform
    end
end
