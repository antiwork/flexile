class AddCapTableNotesToCompanyInvestor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_investors, :cap_table_notes, :string
  end
end
