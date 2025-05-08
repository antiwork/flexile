class RemoveTypeFromWiseRecipients < ActiveRecord::Migration[7.1]
  def change
    remove_column :wise_recipients, :type, :string
  end
end
