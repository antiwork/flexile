# frozen_string_literal: true

class OnboardingState::BaseUser
  include Rails.application.routes.url_helpers

  def initialize(user:, company:)
    if self.class == OnboardingState::BaseUser
      raise NotImplementedError,
            "#{OnboardingState::BaseUser.name} is an abstract class and cannot be instantiated."
    end

    @user = user
    @company = company
  end

  def has_personal_details?
    return @_has_personal_details if defined?(@_has_personal_details)

    @_has_personal_details = user.legal_name.present? && user.preferred_name.present? &&
      user.citizenship_country_code.present?
  end

  def complete?
    has_personal_details?
  end

  def redirect_path
    raise NotImplementedError, "Subclasses must implement a `redirect_path` method"
  end

  def after_complete_onboarding_path
    raise NotImplementedError, "Subclasses must implement a `after_complete_onboarding_path` method"
  end

  private
    attr_reader :user, :company
end
