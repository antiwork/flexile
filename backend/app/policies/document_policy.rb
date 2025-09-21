# frozen_string_literal: true

class DocumentPolicy < ApplicationPolicy
  def create?
    company_administrator?
  end
end
