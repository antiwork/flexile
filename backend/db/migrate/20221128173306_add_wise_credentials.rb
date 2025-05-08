# frozen_string_literal: true

class AddWiseCredentials < ActiveRecord::Migration[7.0]
  def change
    create_table :wise_credentials do |t|
      t.references :company, null: false, index: true
      t.string :profile_id, null: false
      t.string :api_key, null: false
      t.datetime :deleted_at

      t.timestamps
    end

    remove_column :companies, :wise_profile_id, :string
    remove_column :companies, :wise_api_key, :string
  end
end
