# frozen_string_literal: true

class ExpenseCategory < ApplicationRecord
  belongs_to :company
  has_many :invoice_expenses

  validates :name, presence: true
  validates :company, presence: true
end
