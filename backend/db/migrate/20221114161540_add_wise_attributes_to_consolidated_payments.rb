# frozen_string_literal: true

class AddWiseAttributesToConsolidatedPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :consolidated_payments, :type, :string
    add_column :consolidated_payments, :status, :string
    add_column :consolidated_payments, :processor_uuid, :string
    add_column :consolidated_payments, :wise_quote_id, :string
    add_column :consolidated_payments, :wise_transfer_id, :string
    add_column :consolidated_payments, :wise_transfer_status, :string
    add_column :consolidated_payments, :wise_transfer_amount, :decimal
    add_column :consolidated_payments, :wise_transfer_estimate, :datetime
  end
end
