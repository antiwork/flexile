# frozen_string_literal: true

class AddDeletedAtToWiseRecipients < ActiveRecord::Migration[7.0]
  def change
    add_column :wise_recipients, :deleted_at, :datetime
  end
end
