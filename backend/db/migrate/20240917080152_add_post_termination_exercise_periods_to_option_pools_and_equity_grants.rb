class AddPostTerminationExercisePeriodsToOptionPoolsAndEquityGrants < ActiveRecord::Migration[7.2]
  def change
    add_column :option_pools, :voluntary_termination_exercise_months, :integer, default: 120, null: false
    add_column :option_pools, :involuntary_termination_exercise_months, :integer, default: 120, null: false
    add_column :option_pools, :termination_with_cause_exercise_months, :integer, default: 0, null: false
    add_column :option_pools, :death_exercise_months, :integer, default: 120, null: false
    add_column :option_pools, :disability_exercise_months, :integer, default: 120, null: false
    add_column :option_pools, :retirement_exercise_months, :integer, default: 120, null: false

    add_column :equity_grants, :voluntary_termination_exercise_months, :integer
    add_column :equity_grants, :involuntary_termination_exercise_months, :integer
    add_column :equity_grants, :termination_with_cause_exercise_months, :integer
    add_column :equity_grants, :death_exercise_months, :integer
    add_column :equity_grants, :disability_exercise_months, :integer
    add_column :equity_grants, :retirement_exercise_months, :integer

    up_only do
      EquityGrant.reset_column_information

      EquityGrant.find_each do |equity_grant|
        if equity_grant.post_exit_exercise_months == 3
          equity_grant.update!(
            voluntary_termination_exercise_months: 3,
            involuntary_termination_exercise_months: 3,
            termination_with_cause_exercise_months: 0,
            death_exercise_months: 18,
            disability_exercise_months: 12,
            retirement_exercise_months: 3,
          )
        else
          equity_grant.update!(
            voluntary_termination_exercise_months: equity_grant.post_exit_exercise_months,
            involuntary_termination_exercise_months: equity_grant.post_exit_exercise_months,
            termination_with_cause_exercise_months: 0,
            death_exercise_months: equity_grant.post_exit_exercise_months,
            disability_exercise_months: equity_grant.post_exit_exercise_months,
            retirement_exercise_months: equity_grant.post_exit_exercise_months,
          )
        end
      end
    end

    change_column_null :equity_grants, :voluntary_termination_exercise_months, false
    change_column_null :equity_grants, :involuntary_termination_exercise_months, false
    change_column_null :equity_grants, :termination_with_cause_exercise_months, false
    change_column_null :equity_grants, :death_exercise_months, false
    change_column_null :equity_grants, :disability_exercise_months, false
    change_column_null :equity_grants, :retirement_exercise_months, false
  end
end
