class AddRetainedReasonToDividend < ActiveRecord::Migration[7.0]
  def change
    add_column :dividends, :retained_reason, :string
  end
end
