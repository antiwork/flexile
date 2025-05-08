# frozen_string_literal: true

class EquityGrantExercisePresenter
  delegate :id, :requested_at, :exercise_price_usd, :total_cost_cents, :number_of_options,
           private: true, to: :@exercise

  def initialize(exercise)
    @exercise = exercise
  end

  def props
    {
      id:,
      requested_at: requested_at.to_date,
      number_of_options:,
      total_cost_cents:,
    }
  end
end
