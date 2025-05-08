class AddStripeSetupIntentIdToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :stripe_setup_intent_id, :string
  end
end
