class ChangeInvoiceStatusSentToReceived < ActiveRecord::Migration[7.0]
  def up
    Invoice.where(status: "sent").update_all(status: "received")
  end

  def down
    Invoice.where(status: "received").update_all(status: "sent")
  end
end
