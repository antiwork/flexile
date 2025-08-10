# frozen_string_literal: true

class DocumentPolicy < ApplicationPolicy
  def index?
    company_worker.present? || company_investor.present? || company_lawyer.present? || company_administrator.present?
  end

  def create?
    company_administrator.present?
  end

  def sign?
    company_administrator.present? || record.signatories.where(user_id: user.id, signed_at: nil).exists?
  end

  def share?
    create?
  end

  def destroy?
    create?
  end
end
