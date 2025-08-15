# frozen_string_literal: true

class PaymentAccountPolicy < ApplicationPolicy
  def index?
    company_administrator? || company_lawyer?
  end

  def update?
    company_administrator? || company_lawyer?
  end
end