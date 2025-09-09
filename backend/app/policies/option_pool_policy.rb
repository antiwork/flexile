# frozen_string_literal: true

class OptionPoolPolicy < ApplicationPolicy
  def create?
    company_administrator?
  end
end
