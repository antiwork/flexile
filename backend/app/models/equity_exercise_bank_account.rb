# frozen_string_literal: true

class EquityExerciseBankAccount < ApplicationRecord
  belongs_to :company

  encrypts :account_number

  validates :details, presence: true
  validates :account_number, presence: true

  def all_details
    { "Account number" => account_number, **details.to_h }
  end
end
