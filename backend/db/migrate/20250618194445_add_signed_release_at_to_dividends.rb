class AddSignedReleaseAtToDividends < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_rounds, :release_document, :text
    add_column :dividends, :signed_release_at, :datetime
  end
end
