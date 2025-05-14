# frozen_string_literal: true

class InvoiceExpense < ApplicationRecord
  include QuickbooksIntegratable, Serializable

  belongs_to :invoice
  belongs_to :expense_category
  has_one_attached :attachment

  validates :description, presence: true
  validates :invoice, presence: true
  validates :expense_category, presence: true
  validates :attachment, presence: true
  validates :total_amount_in_cents, presence: true

  delegate :expense_account_id, to: :expense_category

  def total_amount_in_usd
    total_amount_in_cents / 100.0
  end

  alias_attribute :cash_amount_in_cents, :total_amount_in_cents
  alias cash_amount_in_usd total_amount_in_usd
end
