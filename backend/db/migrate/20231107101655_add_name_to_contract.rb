class AddNameToContract < ActiveRecord::Migration[7.1]
  def up
    add_column :contracts, :name, :string

    Contract.reset_column_information
    Contract.all.find_in_batches do |contracts|
      Contract.where(id: contracts.map(&:id)).update_all(name: Document::CONSULTING_CONTRACT_NAME)
    end

    change_column_null :contracts, :name, false
  end

  def down
    remove_column :contracts, :name
  end
end
