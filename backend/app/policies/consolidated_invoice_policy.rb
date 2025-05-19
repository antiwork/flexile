# frozen_string_literal: true

class ConsolidatedInvoicePolicy < ApplicationPolicy
  def index?
    company_administrator.present?
  end
end
