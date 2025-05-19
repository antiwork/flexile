class MakeCompanyExternalIdRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        Company.where(external_id: nil).find_each do |company|
          Company::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: Company::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: Company::ExternalIdGenerator::ID_ALPHABET)
            unless Company.where(external_id:).exists?
              company.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :companies, :external_id, unique: true
    change_column_null :companies, :external_id, false
  end
end
