class MakeContractorExternalIdRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        CompanyContractor.where(external_id: nil).find_each do |contractor|
          CompanyContractor::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: CompanyContractor::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: CompanyContractor::ExternalIdGenerator::ID_ALPHABET)
            unless CompanyContractor.where(external_id:).exists?
              contractor.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :company_contractors, :external_id, unique: true
    change_column_null :company_contractors, :external_id, false
  end
end
