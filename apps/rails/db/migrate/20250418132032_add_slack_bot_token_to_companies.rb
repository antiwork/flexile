class AddSlackBotTokenToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :slack_bot_token, :string
  end
end
