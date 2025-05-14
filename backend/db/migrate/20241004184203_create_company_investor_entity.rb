class CreateCompanyInvestorEntity < ActiveRecord::Migration[7.2]
  def change
    create_table :company_investor_entities do |t|
      t.string :external_id, null: false
      t.references :company, null: false
      t.string :name, null: false
      t.bigint :investment_amount_cents, null: false
      t.string :cap_table_notes
      t.bigint :total_shares, default: 0, null: false
      t.bigint :total_options, default: 0, null: false
      t.virtual :fully_diluted_shares, type: :bigint, as: "(total_shares + total_options)", stored: true
      t.index :external_id, unique: true

      t.timestamps
    end
  end
end
