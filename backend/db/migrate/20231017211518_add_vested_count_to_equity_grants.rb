class AddVestedCountToEquityGrants < ActiveRecord::Migration[7.1]
  def up
    change_table :equity_grants, bulk: true do |t|
      t.integer :vested_shares
      t.integer :exercised_shares
      t.integer :expired_shares
      t.integer :unvested_shares
    end

    EquityGrant.reset_column_information
    EquityGrant.all.find_each do |grant|
      grant.vested_shares = grant.number_of_shares
      grant.exercised_shares = 0
      grant.expired_shares = 0
      grant.unvested_shares = 0
      grant.save!
    end

    change_table :equity_grants, bulk: true do |t|
      t.change_null :vested_shares, false
      t.change_null :exercised_shares, false
      t.change_null :expired_shares, false
      t.change_null :unvested_shares, false
    end
  end

  def down
    change_table :equity_grants, bulk: true do |t|
      t.remove :vested_shares
      t.remove :exercised_shares
      t.remove :expired_shares
      t.remove :unvested_shares
    end
  end
end
