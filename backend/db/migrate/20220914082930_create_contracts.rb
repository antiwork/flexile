class CreateContracts < ActiveRecord::Migration[7.0]
  def change
    create_table :contracts do |t|
      t.datetime :signed_at
      t.references :company_contractor, index: true
      t.references :company_administrator, null: false, index: true

      t.timestamps
    end
  end
end
