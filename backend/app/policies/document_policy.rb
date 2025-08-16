# frozen_string_literal: true

class DocumentPolicy < ApplicationPolicy
  def create?
    company_administrator.present?
  end

  def sign?
    company_administrator.present? || record.signatures.where(user_id: user.id, signed_at: nil).exists?
  end
end
