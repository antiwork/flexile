class AddWaterfallFieldsToShareClasses < ActiveRecord::Migration[8.0]
  def change
    add_column :share_classes, :liquidation_preference_multiple, :decimal, default: 1.0, null: false
    add_column :share_classes, :participating, :boolean, default: false, null: false
    add_column :share_classes, :participation_cap_multiple, :decimal
    add_column :share_classes, :seniority_rank, :integer, limit: 2
  end
end
