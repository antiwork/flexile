# frozen_string_literal: true

class AddWiseCredentialIdToWiseRecipients < ActiveRecord::Migration[7.0]
  def change
    add_reference :wise_recipients, :wise_credential, index: true
  end
end
