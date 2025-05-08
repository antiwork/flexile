class AddFullNameToUsers < ActiveRecord::Migration[7.0]

  def up
    add_column :users, :legal_name, :string
    add_column :users, :preferred_name, :string
    User.reset_column_information

    User.find_each do |user|
      user.update!(legal_name: "#{user.first_name} #{user.last_name}", preferred_name: user.first_name)
    end

    remove_column :users, :first_name, :string
    remove_column :users, :last_name, :string
  end

  def down
    add_column :users, :first_name, :string
    add_column :users, :last_name, :string
    User.reset_column_information

    User.find_each do |user|
      first_name, last_name = user.legal_name.split(" ")
      user.update!(first_name: first_name, last_name: last_name)
    end

    remove_column :users, :legal_name
    remove_column :users, :preferred_name
  end
end
