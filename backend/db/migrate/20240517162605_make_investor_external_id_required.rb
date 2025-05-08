class MakeInvestorExternalIdRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        CompanyInvestor.where(external_id: nil).find_each do |investor|
          CompanyInvestor::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: CompanyInvestor::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: CompanyInvestor::ExternalIdGenerator::ID_ALPHABET)
            unless CompanyInvestor.where(external_id:).exists?
              investor.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :company_investors, :external_id, unique: true
    change_column_null :company_investors, :external_id, false
  end
end
