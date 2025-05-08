class CreateCapTableUploads < ActiveRecord::Migration[7.2]
  def change
    create_table :cap_table_uploads do |t|
      t.references :company, null: false
      t.references :user, null: false
      t.datetime :uploaded_at, null: false
      t.string :status, null: false

      t.timestamps
    end
  end
end
