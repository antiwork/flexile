# frozen_string_literal: true

RSpec.describe Balance do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:balance_transactions).through(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:amount_cents) }
    it { is_expected.to validate_numericality_of(:amount_cents).only_integer }

    context "when another record exists" do
      before { create(:company) } # creates a balance in an `after_create`

      it { is_expected.to validate_uniqueness_of(:company_id) }
    end
  end

  describe "#recalculate_amount!" do
    let(:company) { create(:company) }
    let(:balance) { company.balance }

    before do
      create_list(:payment_balance_transaction, 2, company:, amount_cents: 1)
      create_list(:consolidated_payment_balance_transaction, 2, company:, amount_cents: 3)
      create(:payment_balance_transaction, amount_cents: 100)
      balance.update!(amount_cents: 0)
    end

    it "recalculates and updates the amount cents" do
      expect do
        balance.recalculate_amount!
      end.to change { balance.amount_cents }.from(0).to(8)
    end
  end
end
