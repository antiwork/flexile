class MakeCompanyAdministratorExternalIdUnique < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        CompanyAdministrator.where(external_id: nil).find_each do |company_administrator|
          CompanyAdministrator::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: CompanyAdministrator::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: CompanyAdministrator::ExternalIdGenerator::ID_ALPHABET)
            unless CompanyAdministrator.where(external_id:).exists?
              company_administrator.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :company_administrators, :external_id, unique: true
    change_column_null :company_administrators, :external_id, false
  end
end
