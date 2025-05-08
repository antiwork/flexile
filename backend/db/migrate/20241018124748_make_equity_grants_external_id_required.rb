class MakeEquityGrantsExternalIdRequired < ActiveRecord::Migration[7.2]
  def change
    up_only do
      if Rails.env.development?
        EquityGrant.where(external_id: nil).find_each do |equity_grant|
          EquityGrant::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: EquityGrant::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: EquityGrant::ExternalIdGenerator::ID_ALPHABET)
            unless EquityGrant.where(external_id:).exists?
              equity_grant.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :equity_grants, :external_id, unique: true
    change_column_null :equity_grants, :external_id, false
  end
end
