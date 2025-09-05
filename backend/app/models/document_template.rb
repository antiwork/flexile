# frozen_string_literal: true

class DocumentTemplate < ApplicationRecord
  belongs_to :company

  enum :document_type, {
    consulting_contract: 0,
    exercise_notice: 1,
    letter_of_transmittal: 2,
    stock_option_agreement: 3,
  }
  TYPES = %w[exercise_notice consulting_contract letter_of_transmittal stock_option_agreement].freeze

  validates :document_type, presence: true, inclusion: { in: TYPES }
  validates :text, presence: true
end
