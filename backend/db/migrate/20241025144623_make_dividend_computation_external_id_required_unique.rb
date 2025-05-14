class MakeDividendComputationExternalIdRequiredUnique < ActiveRecord::Migration[7.2]
  def change
    up_only do
      if Rails.env.development?
        DividendComputation.where(external_id: nil).find_each do |dividend_computation|
          DividendComputation::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: DividendComputation::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: DividendComputation::ExternalIdGenerator::ID_ALPHABET)
            unless DividendComputation.where(external_id:).exists?
              dividend_computation.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :dividend_computations, :external_id, unique: true
    change_column_null :dividend_computations, :external_id, false
  end
end
