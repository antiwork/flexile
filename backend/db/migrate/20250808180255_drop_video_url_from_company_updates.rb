class DropVideoUrlFromCompanyUpdates < ActiveRecord::Migration[8.0]
  def change
    remove_column :company_updates, :video_url, :text
  end
end
