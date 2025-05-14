# frozen_string_literal: true

class AddWiseCredentialIdToPayments < ActiveRecord::Migration[7.0]
  def change
    add_reference :payments, :wise_credential, index: true
    add_reference :consolidated_payments, :wise_credential, index: true
  end
end
