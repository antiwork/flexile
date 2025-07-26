# frozen_string_literal: true

class RemoveEquityGrantsEnabledFromCompanies < ActiveRecord::Migration[7.0]
  def change
    remove_column :companies, :equity_grants_enabled, :boolean
  end
end