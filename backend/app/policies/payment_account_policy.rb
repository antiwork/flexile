# frozen_string_literal: true

class PaymentAccountPolicy < ApplicationPolicy
  def index?
    company_administrator? || company_lawyer?
  end

  alias_method :update?, :index?
  alias_method :balances?, :index?
  alias_method :pull_funds?, :index?
  alias_method :transfer_to_wise?, :index?
end
