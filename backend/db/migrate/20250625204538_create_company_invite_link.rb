# frozen_string_literal: true

class CreateCompanyInviteLink < ActiveRecord::Migration[8.0]
  def change
    create_table :company_invite_links do |t|
      t.references :company, null: false, foreign_key: true
      t.references :inviter, null: false, foreign_key: { to_table: :users }
      t.references :document_template, foreign_key: true, null: true
      t.string :token, null: false
      t.timestamps
    end

    add_index :company_invite_links, :token, unique: true
    add_index :company_invite_links, [:company_id, :inviter_id, :document_template_id]

    change_table :users do |t|
      t.references :signup_invite_link, foreign_key: { to_table: :company_invite_links }, null: true
    end
  end
end
