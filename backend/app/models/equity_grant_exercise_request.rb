# frozen_string_literal: true

class EquityGrantExerciseRequest < ApplicationRecord
  belongs_to :equity_grant
  belongs_to :equity_grant_exercise
  belongs_to :share_holding, optional: true

  validates :exercise_price_usd, presence: true,
                                 numericality: { greater_than: 0 }
  validates :number_of_options, presence: true,
                                numericality: { only_integer: true, greater_than_or_equal_to: 1 }

  validate :number_of_options_cannot_exceed_vested_shares, on: :create

  def total_cost_cents
    (exercise_price_usd * 100 * number_of_options).round
  end

  private
    def number_of_options_cannot_exceed_vested_shares
      return if equity_grant.nil?
      return if equity_grant.vested_shares >= number_of_options

      errors.add(:number_of_options, "cannot be greater than the number of vested shares in the grant")
    end
end
