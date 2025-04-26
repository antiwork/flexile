# frozen_string_literal: true

class CompanyRole < ApplicationRecord
  include Deletable, ExternalId

  belongs_to :company
  has_many :company_workers
  has_many :expense_cards

  has_one :rate, -> { order(id: :desc) }, class_name: "CompanyRoleRate", required: true, autosave: true
  has_many :company_role_rates

  validates :company_id, presence: true
  validates :name, presence: true
  validates :expense_card_spending_limit_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, presence: true, if: :expense_card_enabled?
  validate :cannot_delete_with_active_contractors

  delegate :pay_rate_in_subunits, :pay_rate_type, :hourly?, :project_based?, :salary?, to: :rate

  def alive?
    deleted_at.nil?
  end

  def expense_card_has_limit?
    expense_card_spending_limit_cents > 0
  end

  private
    def cannot_delete_with_active_contractors
      if deleted_at.present? && deleted_at_changed?
        errors.add(:base, "Cannot delete role with active contractors") if company_workers.active.present?
      end
    end
end
