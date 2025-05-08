class AddReadyForPaymentToEquityBuybackRound < ActiveRecord::Migration[7.2]
  def change
    add_column :equity_buyback_rounds, :ready_for_payment, :boolean, default: false, null: false

    up_only do
      EquityBuybackRound.reset_column_information
      EquityBuybackRound.update_all(ready_for_payment: true)
    end
  end
end
