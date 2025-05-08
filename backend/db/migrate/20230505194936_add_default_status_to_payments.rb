class AddDefaultStatusToPayments < ActiveRecord::Migration[7.0]
  def up
    change_column_default :payments, :status, "initial"
    change_column_default :consolidated_payments, :status, "initial"

    change_column_null :consolidated_payments, :status, false
  end

  def down
    change_column_null :consolidated_payments, :status, true

    change_column_default :payments, :status, nil
    change_column_default :consolidated_payments, :status, nil
  end
end
