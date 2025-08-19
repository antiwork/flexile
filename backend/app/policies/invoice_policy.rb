# frozen_string_literal: true

class InvoicePolicy < ApplicationPolicy
  def index?
    company_worker.present? || company_administrator.present?
  end

  def show?
    index?
  end

  def new?
    company_worker.present?
  end

  def create?
    new?
  end

  def edit?
    new? && Invoice::EDITABLE_STATES.include?(record.status)
  end

  def update?
    edit?
  end

  def microdeposit_verification_details?
    index?
  end

  def export?
    company_administrator.present?
  end

  def approve?
    company_administrator.present?
  end

  def reject?
    approve?
  end

  def destroy?
    new? && Invoice::DELETABLE_STATES.include?(record.status)
  end
end
