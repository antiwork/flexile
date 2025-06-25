class CreateContractorInviteLinks < ActiveRecord::Migration[8.0]
  def change
    create_table :contractor_invite_links do |t|
      t.string :external_id, null: false
      t.string :uuid, null: false
      t.references :company, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      t.timestamps default: -> { "CURRENT_TIMESTAMP" }
    end

    add_index :contractor_invite_links, :external_id, unique: true
    add_index :contractor_invite_links, :uuid, unique: true
    add_index :contractor_invite_links, [:company_id, :user_id], unique: true
  end
end