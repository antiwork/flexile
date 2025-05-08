class AddBoardMemberToCompanyAdministrators < ActiveRecord::Migration[7.2]
  def change
    add_column :company_administrators, :board_member, :boolean, null: false, default: false
  end
end
