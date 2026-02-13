# frozen_string_literal: true

class AddImpliedSharesToDividends < ActiveRecord::Migration[7.2]
  def change
    add_column :dividends, :implied_shares, :boolean, default: false, null: false
  end
end
