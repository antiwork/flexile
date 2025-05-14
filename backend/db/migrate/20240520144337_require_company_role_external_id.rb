class RequireCompanyRoleExternalId < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        CompanyRole.where(external_id: nil).find_each do |role|
          CompanyRole::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: CompanyRole::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: CompanyRole::ExternalIdGenerator::ID_ALPHABET)
            unless CompanyRole.where(external_id:).exists?
              role.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :company_roles, :external_id, unique: true
    change_column_null :company_roles, :external_id, false
  end
end
