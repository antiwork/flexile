class AddFlagsToShareClasses < ActiveRecord::Migration[7.1]
  def change
    add_column :share_classes, :flags, :bigint, default: 0, null: false
  end
end
