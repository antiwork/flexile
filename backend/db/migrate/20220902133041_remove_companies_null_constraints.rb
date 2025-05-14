# frozen_string_literal: true

class RemoveCompaniesNullConstraints < ActiveRecord::Migration[7.0]
  def up
    change_column_null(:companies, :registration_number, true)
    change_column_null(:companies, :street_address, true)
    change_column_null(:companies, :city, true)
    change_column_null(:companies, :state, true)
    change_column_null(:companies, :zip_code, true)
    change_column_null(:companies, :country, true)
  end

  def down
    change_column_null(:companies, :registration_number, false)
    change_column_null(:companies, :street_address, false)
    change_column_null(:companies, :city, false)
    change_column_null(:companies, :state, false)
    change_column_null(:companies, :zip_code, false)
    change_column_null(:companies, :country, false)
  end
end
