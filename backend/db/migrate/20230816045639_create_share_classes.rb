class CreateShareClasses < ActiveRecord::Migration[7.0]
  def change
    create_table :share_classes do |t|
      t.references :company, null: false, index: true
      t.string :name, null: false
      t.decimal :original_issue_price_in_dollars
      t.decimal :hurdle_rate

      t.timestamps
    end
  end
end
