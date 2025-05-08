# frozen_string_literal: true

class CreateCompanyUpdates < ActiveRecord::Migration[7.1]
  def change
    create_table :company_updates do |t|
      t.references :company, null: false, index: true
      t.string :title, null: false
      t.text :body, null: false
      t.bigint :flags, default: 0, null: false
      t.text :video_url
      t.datetime :sent_at
      t.timestamps
    end

    add_index :company_updates, :title, unique: true
  end
end
