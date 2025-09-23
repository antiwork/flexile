# frozen_string_literal: true

class DocumentTemplatesPolicy < ApplicationPolicy
  def index?
    company_administrator?
  end

  def show?
    company_administrator? || company_investor?
  end

  def update?
    company_administrator?
  end
end
