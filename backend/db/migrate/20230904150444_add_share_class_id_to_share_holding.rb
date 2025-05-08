class AddShareClassIdToShareHolding < ActiveRecord::Migration[7.0]
  def up
    add_reference :share_holdings, :share_class

    ShareHolding.reset_column_information
    ShareHolding.all.each do |share_holding|
      share_class = ShareClass.find_by(company_id: share_holding.company_investor.company_id,
                                       name: share_holding.share_type)
      share_holding.update!(share_class_id: share_class.id)
    end

    change_column_null :share_holdings, :share_class_id, false
    remove_column :share_holdings, :share_type
  end

  def down
    add_column :share_holdings, :share_type, :string

    ShareHolding.reset_column_information
    ShareHolding.all.each do |share_holding|
      share_holding.update!(share_type: share_holding.share_class.name)
    end

    change_column_null :share_holdings, :share_type, false
    remove_reference :share_holdings, :share_class
  end
end
