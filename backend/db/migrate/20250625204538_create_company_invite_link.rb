# frozen_string_literal: true

class CreateCompanyInviteLink < ActiveRecord::Migration[8.0]
  def change
    create_table :company_invite_links do |t|
      t.references :company, null: false
      t.references :document_template, null: true
      t.string :token, null: false
      t.timestamps
    end

    add_index :company_invite_links, :token, unique: true
    add_index :company_invite_links, [:company_id, :document_template_id], unique: true

    change_table :users do |t|
      t.references :signup_invite_link, null: true
    end

    change_column_null :company_contractors, :role, true
  end
end
