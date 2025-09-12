# frozen_string_literal: true

class CreateOptionPool
  def initialize(company:, name:, authorized_shares:, share_class:, default_option_expiry_months:,
                 voluntary_termination_exercise_months:, involuntary_termination_exercise_months:,
                 termination_with_cause_exercise_months:, death_exercise_months:, disability_exercise_months:,
                 retirement_exercise_months:)
    @company = company
    @name = name
    @authorized_shares = authorized_shares
    @share_class = share_class
    @default_option_expiry_months = default_option_expiry_months
    @voluntary_termination_exercise_months = voluntary_termination_exercise_months
    @involuntary_termination_exercise_months = involuntary_termination_exercise_months
    @termination_with_cause_exercise_months = termination_with_cause_exercise_months
    @death_exercise_months = death_exercise_months
    @disability_exercise_months = disability_exercise_months
    @retirement_exercise_months = retirement_exercise_months
  end

  def process
    return { success: false, error: "Share class must be selected" } if share_class.nil?

    option_pool = company.option_pools.build(
      name:,
      authorized_shares:,
      share_class:,
      issued_shares: 0,
      default_option_expiry_months:,
      voluntary_termination_exercise_months:,
      involuntary_termination_exercise_months:,
      termination_with_cause_exercise_months:,
      death_exercise_months:,
      disability_exercise_months:,
      retirement_exercise_months:
    )

    if option_pool.save
      { success: true, option_pool: }
    else
      { success: false, error: option_pool.errors.full_messages.join(", ") }
    end
  end

  private
    attr_reader :company, :name, :authorized_shares, :share_class, :default_option_expiry_months,
                :voluntary_termination_exercise_months, :involuntary_termination_exercise_months,
                :termination_with_cause_exercise_months, :death_exercise_months, :disability_exercise_months,
                :retirement_exercise_months
end
