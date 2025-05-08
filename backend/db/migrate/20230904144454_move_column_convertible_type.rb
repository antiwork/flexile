class MoveColumnConvertibleType < ActiveRecord::Migration[7.0]
  def up
    add_column :convertible_investments, :convertible_type, :string

    ConvertibleInvestment.reset_column_information
    ConvertibleInvestment.all.each do |investment|
      investment.update!(convertible_type: investment.convertible_securities.first.convertible_type)
    end

    change_column_null :convertible_investments, :convertible_type, false
    remove_column :convertible_securities, :convertible_type
  end

  def down
    add_column :convertible_securities, :convertible_type, :string

    ConvertibleSecurity.reset_column_information
    ConvertibleSecurity.includes(:convertible_investment).each do |security|
      security.update!(convertible_type: security.convertible_investment.convertible_type)
    end

    change_column_null :convertible_securities, :convertible_type, false
    remove_column :convertible_investments, :convertible_type
  end
end
