class CreateBoardConsents < ActiveRecord::Migration[8.0]
  def change
    create_enum :board_consent_status, %w[pending lawyer_approved board_approved]
    create_table :board_consents do |t|
      t.references :equity_allocation, null: false
      t.references :company_investor, null: false
      t.references :company, null: false
      t.references :document, null: false
      t.enum :status, enum_type: :board_consent_status, null: false
      t.datetime :lawyer_approved_at
      t.datetime :board_approved_at

      t.timestamps
    end
  end
end
