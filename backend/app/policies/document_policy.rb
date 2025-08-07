# frozen_string_literal: true

class DocumentPolicy < ApplicationPolicy
  def index?
    company_worker.present? || company_investor.present? || company_lawyer.present? || company_administrator.present?
  end

  def create?
    company_administrator.present?
  end

  def sign?
    index?
  end

  def share?
    create?
  end

  def destroy?
    create?
  end
end
