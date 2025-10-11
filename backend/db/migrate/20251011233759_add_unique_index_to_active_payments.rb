# frozen_string_literal: true

class AddUniqueIndexToActivePayments < ActiveRecord::Migration[8.0]
  def change
    # Add a unique partial index to prevent multiple active payments per invoice
    # This is a database-level safeguard against the race condition where
    # multiple jobs might try to create payments for the same invoice
    add_index :payments,
              :invoice_id,
              unique: true,
              where: "status = 'initial'",
              name: "index_payments_on_invoice_id_where_active"
  end
end
