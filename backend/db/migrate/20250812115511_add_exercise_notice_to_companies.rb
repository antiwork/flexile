class AddExerciseNoticeToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :exercise_notice, :text
  end
end
