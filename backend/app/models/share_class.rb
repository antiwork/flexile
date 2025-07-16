# frozen_string_literal: true

class ShareClass < ApplicationRecord
  belongs_to :company
  has_many :share_holdings

  validates :name, presence: true, uniqueness: { scope: :company_id }
  validates :liquidation_preference_multiple, presence: true,
                                              numericality: { greater_than_or_equal_to: 0 }
  validates :participating, inclusion: { in: [true, false] }
  validates :participation_cap_multiple, numericality: { greater_than: 0 },
                                         allow_nil: true
  validates :seniority_rank, numericality: { greater_than_or_equal_to: 0, only_integer: true },
                             allow_nil: true
end
