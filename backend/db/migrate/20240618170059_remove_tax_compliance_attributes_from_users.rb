class RemoveTaxComplianceAttributesFromUsers < ActiveRecord::Migration[7.1]
  def up
    change_table :users, bulk: true do |t|
      t.remove :tax_id
      t.remove :business_name
      t.remove :tax_id_status
      t.remove :tax_information_confirmed_at
    end
  end

  def down
    change_table :users, bulk: true do |t|
      t.string :tax_id
      t.string :business_name
      t.string :tax_id_status
      t.datetime :tax_information_confirmed_at
    end
  end
end
