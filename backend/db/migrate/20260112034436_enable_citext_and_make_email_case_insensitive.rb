# frozen_string_literal: true

class EnableCitextAndMakeEmailCaseInsensitive < ActiveRecord::Migration[8.0]
  def up
    enable_extension "citext"
    change_column :users, :email, :citext
  end

  def down
    change_column :users, :email, :string
    disable_extension "citext"
  end
end
