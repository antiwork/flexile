class MakeDividendRoundExternalIdRequiredUnique < ActiveRecord::Migration[7.2]
  def change
    up_only do
      if Rails.env.development?
        DividendRound.where(external_id: nil).find_each do |dividend_round|
          DividendRound::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: DividendRound::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: DividendRound::ExternalIdGenerator::ID_ALPHABET)
            unless DividendRound.where(external_id:).exists?
              dividend_round.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :dividend_rounds, :external_id, unique: true
    change_column_null :dividend_rounds, :external_id, false
  end
end
