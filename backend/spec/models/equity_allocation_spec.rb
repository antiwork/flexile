# frozen_string_literal: true

RSpec.describe EquityAllocation do
  describe "associations" do
    it { is_expected.to belong_to(:company_worker) }
  end

  describe "validations" do
    it do
      is_expected.to(validate_numericality_of(:equity_percentage)
                       .is_greater_than_or_equal_to(0)
                       .is_less_than_or_equal_to(CompanyWorker::MAX_EQUITY_PERCENTAGE)
                       .only_integer
                       .allow_nil)
    end

    it { is_expected.to validate_presence_of(:year) }
    it do
      is_expected.to(validate_numericality_of(:year)
                       .is_greater_than_or_equal_to(2020)
                       .is_less_than_or_equal_to(3000)
                       .only_integer)
    end

    context "when another record exists" do
      before { create(:equity_allocation) }

      it { is_expected.to validate_uniqueness_of(:year).scoped_to(:company_contractor_id) }
    end

    it { is_expected.to define_enum_for(:status).with_values(described_class.statuses).backed_by_column_of_type(:enum) }

    describe "changing equity_percentage" do
      it "disallows unsetting the equity percentage value" do
        equity_allocation = create(:equity_allocation)
        equity_allocation.update(equity_percentage: 10)
        expect(equity_allocation.errors[:equity_percentage]).to be_empty

        equity_allocation.update(equity_percentage: nil)
        expect(equity_allocation.errors[:equity_percentage]).to eq(["cannot be unset once set"])
      end

      it "disallows changing the equity percentage value when locked" do
        equity_allocation = create(:equity_allocation)
        equity_allocation.update(equity_percentage: 10)
        expect(equity_allocation.errors[:equity_percentage]).to be_empty

        equity_allocation.update!(locked: true)
        expect(equity_allocation).to be_valid
        equity_allocation.update(equity_percentage: 20)
        expect(equity_allocation.errors[:equity_percentage]).to eq(["cannot be changed once locked"])
      end

      it "allows setting the lock and an equity percentage on creation" do
        # Doesn't happen in practice but tests depend on it so we need to allow it
        equity_allocation = create(:equity_allocation, :locked, equity_percentage: 12)
        expect(equity_allocation).to be_valid
        expect(equity_allocation.errors[:equity_percentage]).to be_empty
      end
    end

    it "disallows locking without setting an equity percentage value" do
      equity_allocation = create(:equity_allocation)
      equity_allocation.update(locked: true)

      expect(equity_allocation.errors[:base]).to eq(["Cannot lock equity percentage without setting a value"])
    end
  end
end
