class AddUpdateAttributesToTasks < ActiveRecord::Migration[7.2]
  def up
    change_table :tasks do |t|
      t.datetime :completed_at
      t.change :name, :text
    end
  end

  def down
    change_table :tasks do |t|
      t.change :name, :string
      t.remove :completed_at
    end
  end
end
