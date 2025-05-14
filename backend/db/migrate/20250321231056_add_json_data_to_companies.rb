class AddJsonDataToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :json_data, :jsonb, default: { flags: [] }, null: false
    up_only do
      Company.find_each do |company|
        company.update_column(:json_data, { flags: [Flipper.enabled?(:option_exercising, company) ? "option_exercising" : nil].compact })
      end
    end
  end
end
