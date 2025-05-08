class AddReadyForPaymentToDividendRound < ActiveRecord::Migration[7.2]
  def change
    add_column :dividend_rounds, :ready_for_payment, :boolean, default: false, null: false

    up_only do
      DividendRound.reset_column_information
      DividendRound.update_all(ready_for_payment: true)
    end
  end
end
