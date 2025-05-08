# frozen_string_literal: true

class RenameServiceFeeCentsToFlexileFeeCents < ActiveRecord::Migration[7.1]
  def change
    rename_column :consolidated_invoices, :service_fee_cents, :flexile_fee_cents
  end
end
