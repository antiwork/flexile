class MakeDocumentTemplatesCompanyIdNullable < ActiveRecord::Migration[8.0]
  def change
    change_column_null :document_templates, :company_id, true
  end
end
