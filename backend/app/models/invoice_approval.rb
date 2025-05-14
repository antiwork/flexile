# frozen_string_literal: true

class InvoiceApproval < ApplicationRecord
  belongs_to :invoice, counter_cache: true
  belongs_to :approver, class_name: "User"

  validates_presence_of :invoice, :approver, :approved_at
  validates_uniqueness_of :invoice_id, scope: :approver_id

  validate :approver_must_be_an_administrator

  before_validation :set_approved_timestamp

  private
    def approver_must_be_an_administrator
      return if approver&.company_administrator_for?(invoice.company)

      errors.add(:base, "Only company administrators can approve invoices.")
    end

    def set_approved_timestamp
      self.approved_at ||= Time.current
    end
end
