class MakeCompanyUpdatesExternalIdUniqueAndRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        CompanyUpdate.where(external_id: nil).find_each do |company_update|
          CompanyUpdate::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: CompanyUpdate::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: CompanyUpdate::ExternalIdGenerator::ID_ALPHABET)
            unless CompanyUpdate.where(external_id:).exists?
              company_update.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    change_column_null :company_updates, :external_id, false
    add_index :company_updates, :external_id, unique: true
  end
end
