# frozen_string_literal: true

class AddStatusToConsolidatedInvoices < ActiveRecord::Migration[7.0]
  def change
    add_column :consolidated_invoices, :status, :string
  end
end
