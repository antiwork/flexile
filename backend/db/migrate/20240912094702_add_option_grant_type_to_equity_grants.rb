class AddOptionGrantTypeToEquityGrants < ActiveRecord::Migration[7.2]
  def change
    create_enum :equity_grants_option_grant_type, %w[iso nso]
    add_column :equity_grants, :option_grant_type, :enum, enum_type: :equity_grants_option_grant_type, null: false, default: "nso"
  end
end
