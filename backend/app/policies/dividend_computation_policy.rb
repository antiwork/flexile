# frozen_string_literal: true

class DividendComputationPolicy < ApplicationPolicy
  def index?
    company_administrator? || company_lawyer?
  end

  def show?
    index?
  end

  def create?
    index?
  end

  def update?
    index?
  end

  def destroy?
    index?
  end

  def preview?
    index?
  end
end