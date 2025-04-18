class AddStatusToEquityAllocations < ActiveRecord::Migration[8.0]
  def change
    create_enum :equity_allocations_status, %w[pending_confirmation pending_grant_creation pending_approval approved]
    add_column :equity_allocations, :status, :enum, enum_type: :equity_allocations_status, default: "pending_confirmation"

    up_only do
      EquityAllocation.where(locked: true).update_all(status: "approved")
      EquityAllocation.where(locked: false).update_all(status: "pending_confirmation")
    end

    change_column_null :equity_allocations, :status, false
  end
end
