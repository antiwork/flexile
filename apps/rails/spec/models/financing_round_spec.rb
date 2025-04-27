# frozen_string_literal: true

RSpec.describe FinancingRound, skip: "Feature removed" do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:shares_issued) }
    it { is_expected.to validate_numericality_of(:shares_issued).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:price_per_share_cents) }
    it { is_expected.to validate_numericality_of(:price_per_share_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:amount_raised_cents) }
    it { is_expected.to validate_numericality_of(:amount_raised_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:post_money_valuation_cents) }
    it { is_expected.to validate_numericality_of(:post_money_valuation_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w(Issued)) }

    describe "investors JSON validation" do
      let(:company) { create(:company) }
      let(:valid_investors) do
        [
          { name: "Investor 1", amount_invested_cents: 1000000 },
          { name: "Investor 2", amount_invested_cents: 2000000 }
        ]
      end

      subject(:financing_round) do
        build(:financing_round, company: company, investors: investors)
      end

      context "with valid investors JSON" do
        let(:investors) { valid_investors }

        it "is valid" do
          expect(financing_round).to be_valid
        end
      end

      context "with `investors` set to `nil`" do
        let(:investors) { nil }

        it "is invalid" do
          expect(financing_round).to be_invalid
          expect(financing_round.errors[:investors]).to be_present
        end
      end

      context "with invalid investors JSON" do
        let(:investors) do
          [
            { name: "Invalid Investor", amount_invested_cents: "not a number" }
          ]
        end

        it "is invalid" do
          expect(financing_round).to be_invalid
          expect(financing_round.errors[:investors]).to be_present
        end
      end

      context "with missing required fields" do
        let(:investors) do
          [
            { name: "Incomplete Investor" }
          ]
        end

        it "is invalid" do
          expect(financing_round).to be_invalid
          expect(financing_round.errors[:investors]).to be_present
        end
      end

      context "with the default value" do
        let(:investors) { [] }

        it "is valid" do
          expect(financing_round).to be_valid
        end
      end
    end
  end

  describe "attributes" do
    it "sets a default value for `investors`" do
      financing_round = FinancingRound.new
      expect(financing_round.investors).to eq([])
    end
  end
end
