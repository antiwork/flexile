class AddAddressColumnsToInvoices < ActiveRecord::Migration[7.1]
  def up
    add_column :invoices, :street_address, :string
    add_column :invoices, :city, :string
    add_column :invoices, :state, :string
    add_column :invoices, :zip_code, :string
    add_column :invoices, :country, :string

    execute  <<~SQL
      UPDATE invoices
      SET street_address = users.street_address,
          city = users.city,
          state = users.state,
          zip_code = users.zip_code,
          country = users.residence_country
      FROM users
      WHERE invoices.user_id = users.id;
    SQL
  end

  def down
    remove_columns :invoices, :street_address, :city, :state, :zip_code, :country
  end
end
