class RemoveCompanyInviteLinks < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :invite_link, :string
    add_index :companies, :invite_link, unique: true

    up_only do
      execute "UPDATE companies SET invite_link = (SELECT token FROM company_invite_links WHERE company_id = companies.id AND document_template_id IS NULL)"
    end
    remove_index :company_invite_links, :token, unique: true
    remove_index :company_invite_links, [:company_id, :document_template_id], unique: true
    drop_table :company_invite_links do |t|
      t.references :company, null: false
      t.references :document_template, null: true
      t.string :token, null: false
      t.timestamps
    end
    remove_index :users, :signup_invite_link_id
    remove_column :users, :signup_invite_link_id, :bigint
  end
end
