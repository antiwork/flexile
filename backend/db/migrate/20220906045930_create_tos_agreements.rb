class CreateTosAgreements < ActiveRecord::Migration[7.0]
  def change
    create_table :tos_agreements do |t|
      t.references :user, null: false
      t.string :ip_address, null: false

      t.timestamps
    end
  end
end
