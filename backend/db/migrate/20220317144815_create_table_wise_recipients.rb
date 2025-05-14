class CreateTableWiseRecipients < ActiveRecord::Migration[7.0]
  def change
    create_table :wise_recipients do |t|
      t.references :user, null: false, index: true
      t.string :recipient_id, null: false
      t.string :bank_name
      t.string :last_four_digits
      t.timestamps
    end
  end
end
