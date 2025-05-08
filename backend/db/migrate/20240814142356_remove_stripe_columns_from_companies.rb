class RemoveStripeColumnsFromCompanies < ActiveRecord::Migration[7.1]
  def up
    change_table :companies do |t|
      t.remove :stripe_setup_intent_id, :bank_account_last_four
    end
  end

  def down
    change_table :companies do |t|
      t.string :stripe_setup_intent_id
      t.string :bank_account_last_four
    end
  end
end
