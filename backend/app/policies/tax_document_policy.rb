# frozen_string_literal: true

# TODO (techdebt): remove as no longer used
class TaxDocumentPolicy < ApplicationPolicy
  def index?
    company_administrator.present? ||
      company_worker.present? ||
      company_investor.present? ||
      company_lawyer.present?
  end
end
