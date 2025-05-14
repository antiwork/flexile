# frozen_string_literal: true

class AddTypeToWiseRecipients < ActiveRecord::Migration[7.0]
  def change
    add_column :wise_recipients, :type, :string
    change_column_null :wise_recipients, :user_id, true
  end
end
