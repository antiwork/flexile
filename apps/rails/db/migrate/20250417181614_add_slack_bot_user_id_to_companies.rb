class AddSlackBotUserIdToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :slack_bot_user_id, :string
  end
end
