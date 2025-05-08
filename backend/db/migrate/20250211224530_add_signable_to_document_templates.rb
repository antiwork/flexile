class AddSignableToDocumentTemplates < ActiveRecord::Migration[7.2]
  def up
    change_table :document_templates do |t|
      t.boolean :signable, default: false, null: false
      t.bigint :docuseal_id
    end
    ActiveRecord::Base.connection.execute("UPDATE document_templates SET docuseal_id = external_template_id::bigint")
    change_table :document_templates, bulk: true do |t|
      t.remove :external_template_id
      t.change_null :docuseal_id, false
    end
  end

  def down
    change_table :document_templates, bulk: true do |t|
      t.string :external_template_id
      t.index :external_template_id
      t.remove :signable
    end
    ActiveRecord::Base.connection.execute("UPDATE document_templates SET external_template_id = docuseal_id::text")
    change_table :document_templates, bulk: true do |t|
      t.change_null :external_template_id, false
      t.remove :docuseal_id
    end
  end
end
