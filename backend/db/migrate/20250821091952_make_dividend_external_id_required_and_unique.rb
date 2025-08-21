class MakeDividendExternalIdRequiredAndUnique < ActiveRecord::Migration[8.0]
  def change
    up_only do
      if Rails.env.development?
        Dividend.where(external_id: nil).find_each do |role|
          Dividend::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: Dividend::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: Dividend::ExternalIdGenerator::ID_ALPHABET)
            unless Dividend.where(external_id:).exists?
              role.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :dividends, :external_id, unique: true
    change_column_null :dividends, :external_id, false
  end
end
