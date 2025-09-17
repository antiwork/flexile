# frozen_string_literal: true

class DocumentTemplate < ApplicationRecord
  belongs_to :company

  enum :document_type, {
    consulting_contract: 0,
    exercise_notice: 1,
    letter_of_transmittal: 2,
    stock_option_agreement: 3,
  }

  validates :text, presence: true
end
