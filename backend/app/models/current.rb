# frozen_string_literal: true

class Current < ActiveSupport::CurrentAttributes
  attribute :company, :company_administrator, :company_worker, :company_investor, :company_lawyer, :user, :whodunnit, :authenticated_user, :impersonated_user

  # Current.user represents the effective user for the request.
  # It serves as the single source of truth for the current user within the application.

  # The actual human initiating the request.
  def authenticated_user=(user)
    super
    self.whodunnit = user&.id
    update_user
  end

  # The identity the authenticated_user is temporarily assuming.
  def impersonated_user=(user)
    super
    update_user
  end

  def whodunnit=(whodunnit)
    super
    PaperTrail.request.whodunnit = whodunnit
  end

  def company_administrator!
    company_administrator || raise(ActiveRecord::RecordNotFound)
  end

  def company_worker!
    company_worker || raise(ActiveRecord::RecordNotFound)
  end

  def company_investor!
    company_investor || raise(ActiveRecord::RecordNotFound)
  end

  def company_lawyer!
    company_lawyer || raise(ActiveRecord::RecordNotFound)
  end

  def company_administrator?
    company_administrator.present?
  end

  private
    def update_user
      self.user = impersonated_user || authenticated_user
    end
end
