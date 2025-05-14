# frozen_string_literal: true

RSpec.describe BalanceTransaction do
  describe "associations" do
    it { is_expected.to belong_to(:company).optional(false) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:amount_cents) }
    it { is_expected.to validate_presence_of(:transaction_type) }
    it { is_expected.to validate_inclusion_of(:transaction_type).in_array(BalanceTransaction::TRANSACTION_TYPES) }

    describe "`amount_cents` immutability" do
      it "allows setting `amount_cents` initially" do
        balance_transaction = create(:payment_balance_transaction, amount_cents: 456)
        expect(balance_transaction.errors.full_messages).to eq []
      end

      it "disallows changing `amount_cents` once set" do
        balance_transaction = create(:payment_balance_transaction, amount_cents: 456)
        balance_transaction.amount_cents = 789
        balance_transaction.save
        expect(balance_transaction.errors.full_messages).to eq ["Amount cents cannot be changed once set"]
      end
    end
  end

  describe "lifecycle hooks" do
    describe "#update_balance!" do
      let(:company) { create(:company) }
      let(:payment) { create(:payment, invoice: create(:invoice, company:)) }

      it "updates the company's balance after creation" do
        balance_transaction = build(:payment_balance_transaction, company:, payment:, amount_cents: 456)

        expect do
          balance_transaction.save!
        end.to change { company.balance.amount_cents }.from(0).to(456)
      end

      it "updates the company's balance if it is destroyed" do
        balance_transaction = create(:payment_balance_transaction, company:, payment:, amount_cents: 456)

        expect do
          balance_transaction.destroy!
        end.to change { company.balance.amount_cents }.from(456).to(0)
      end
    end
  end
end
