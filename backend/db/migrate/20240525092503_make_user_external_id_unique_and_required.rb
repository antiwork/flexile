class MakeUserExternalIdUniqueAndRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        User.where(external_id: nil).find_each do |user|
          User::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: User::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: User::ExternalIdGenerator::ID_ALPHABET)
            unless User.where(external_id:).exists?
              user.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    change_column_null :users, :external_id, false
    add_index :users, :external_id, unique: true
  end
end
