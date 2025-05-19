class MakeOptionPoolExternalIdUniqueAndRequired < ActiveRecord::Migration[7.2]
  def change
    up_only do
      if Rails.env.development?
        OptionPool.where(external_id: nil).find_each do |option_pool|
          OptionPool::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: OptionPool::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: OptionPool::ExternalIdGenerator::ID_ALPHABET)
            unless OptionPool.where(external_id:).exists?
              option_pool.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    change_column_null :option_pools, :external_id, false
    add_index :option_pools, :external_id, unique: true
  end
end
