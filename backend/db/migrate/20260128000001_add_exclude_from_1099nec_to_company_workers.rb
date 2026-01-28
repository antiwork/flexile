# frozen_string_literal: true

class AddExcludeFrom1099necToCompanyWorkers < ActiveRecord::Migration[7.0]
  def change
    add_column :company_workers, :exclude_from_1099nec, :boolean, default: false, null: false
    add_column :company_workers, :exclude_from_1099nec_reason, :text
    add_column :company_workers, :exclude_from_1099nec_set_by_user_id, :bigint
    add_column :company_workers, :exclude_from_1099nec_set_at, :datetime

    add_index :company_workers, :exclude_from_1099nec
    add_index :company_workers, :exclude_from_1099nec_set_by_user_id
  end
end
