# frozen_string_literal: true

class Current < ActiveSupport::CurrentAttributes
  attribute :company, :company_administrator, :company_worker, :company_investor, :company_lawyer, :user, :whodunnit

  def user=(user)
    super
    self.whodunnit = user&.id
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
end
