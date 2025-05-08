# frozen_string_literal: true

class AddWiseCredentialsToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :wise_profile_id, :string
    add_column :companies, :wise_api_key, :string
  end
end
