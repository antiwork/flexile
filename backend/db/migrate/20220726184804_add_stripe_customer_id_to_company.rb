class AddStripeCustomerIdToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :stripe_customer_id, :string
  end
end
