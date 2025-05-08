class MakeExternalIdUnique < ActiveRecord::Migration[7.1]
  def change
    up_only do
      if Rails.env.development?
        Invoice.where(external_id: nil).find_each do |invoice|
          Invoice::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: Invoice::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: Invoice::ExternalIdGenerator::ID_ALPHABET)
            unless Invoice.where(external_id:).exists?
              invoice.update_columns(external_id:)
              break
            end
          end
        end
      end
    end

    add_index :invoices, :external_id, unique: true
    change_column_null :invoices, :external_id, false
  end
end
