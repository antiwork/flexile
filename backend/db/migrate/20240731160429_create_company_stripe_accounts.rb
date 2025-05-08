# frozen_string_literal: true

class CreateCompanyStripeAccounts < ActiveRecord::Migration[7.1]
  def change
    create_table :company_stripe_accounts do |t|
      t.references :company, null: false, index: true
      t.string :status, null: false, default: "initial"
      t.string :setup_intent_id, null: false
      t.string :bank_account_last_four
      t.datetime :deleted_at

      t.timestamps
    end
  end
end
