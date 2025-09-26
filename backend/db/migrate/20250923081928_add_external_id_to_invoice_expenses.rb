class AddExternalIdToInvoiceExpenses < ActiveRecord::Migration[8.0]
  def change
    add_column :invoice_expenses, :external_id, :string

    up_only do
      InvoiceExpense.where(external_id: nil).find_each do |expense|
        InvoiceExpense::ExternalIdGenerator::ID_MAX_RETRY.times do
            external_id = Nanoid.generate(size: InvoiceExpense::ExternalIdGenerator::ID_LENGTH,
                                          alphabet: InvoiceExpense::ExternalIdGenerator::ID_ALPHABET)
            unless InvoiceExpense.where(external_id:).exists?
              expense.update_columns(external_id:)
              break
            end
          end
      end
    end

    add_index :invoice_expenses, :external_id, unique: true
    change_column_null :invoice_expenses, :external_id, false
  end
end
