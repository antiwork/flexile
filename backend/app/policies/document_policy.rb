# frozen_string_literal: true

class DocumentPolicy < ApplicationPolicy
  def create?
    company_administrator?
  end

  def signed?
    company_administrator? || record.signatures.any? { |signature| signature.user == user }
  end
end
