class AddVestingMetadataToEquityGrants < ActiveRecord::Migration[7.2]
  def change
    add_reference :equity_grants, :vesting_schedule
    create_enum :equity_grants_vesting_trigger, %w[scheduled invoice_paid]
    add_column :equity_grants, :vesting_trigger, :enum, enum_type: :equity_grants_vesting_trigger

    EquityGrant.reset_column_information
    EquityGrant.update_all(vesting_trigger: "invoice_paid")

    change_column_null :equity_grants, :vesting_trigger, false
  end
end
