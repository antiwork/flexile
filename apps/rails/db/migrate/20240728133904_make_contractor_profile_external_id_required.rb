class MakeContractorProfileExternalIdRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        ContractorProfile.where(external_id: nil).find_each do |contractor_profile|
          ContractorProfile::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: ContractorProfile::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: ContractorProfile::ExternalIdGenerator::ID_ALPHABET)
            unless ContractorProfile.where(external_id:).exists?
              contractor_profile.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :contractor_profiles, :external_id, unique: true
    change_column_null :contractor_profiles, :external_id, false
  end
end
