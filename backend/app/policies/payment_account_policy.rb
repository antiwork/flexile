# frozen_string_literal: true

class PaymentAccountPolicy < ApplicationPolicy
  def index?
    company_administrator? || company_lawyer?
  end

  alias_method :update?, :index?
end