class CreateCompanyContractorAbsences < ActiveRecord::Migration[7.2]
  def change
    create_table :company_contractor_absences do |t|
      t.timestamps

      t.references :company_contractor, null: false, index: true
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.text :notes
    end
  end
end
