# frozen_string_literal: true

class RemoveCapTableEnabledFromCompanies < ActiveRecord::Migration[7.0]
  def change
    remove_column :companies, :cap_table_enabled, :boolean
  end
end