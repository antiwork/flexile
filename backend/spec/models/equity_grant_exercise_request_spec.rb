# frozen_string_literal: true

RSpec.describe EquityGrantExerciseRequest do
  describe "associations" do
    it { is_expected.to belong_to(:equity_grant) }
    it { is_expected.to belong_to(:equity_grant_exercise) }
    it { is_expected.to belong_to(:share_holding).optional(true) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:exercise_price_usd) }
    it { is_expected.to validate_numericality_of(:exercise_price_usd).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:number_of_options) }
    it { is_expected.to validate_numericality_of(:number_of_options).is_greater_than_or_equal_to(1).only_integer }
  end

  describe "callbacks" do
    context "#number_of_options_cannot_exceed_vested_shares" do
      let(:equity_grant) { create(:equity_grant) }
      let(:equity_grant_exercise_request) { build(:equity_grant_exercise_request, equity_grant:, number_of_options:) }

      context "when number of options exceeds the vested shares" do
        let(:number_of_options) { equity_grant.vested_shares + 1 }

        it "is not valid" do
          expect(equity_grant_exercise_request).not_to be_valid
        end
      end

      context "when number of options is less than the vested shares" do
        let(:number_of_options) { equity_grant.vested_shares - 1 }

        it "is valid" do
          expect(equity_grant_exercise_request).to be_valid
        end
      end

      it "does not validate the number of options on update" do
        equity_grant_exercise_request = create(:equity_grant_exercise_request, equity_grant:, number_of_options: equity_grant.vested_shares)

        equity_grant_exercise_request.update!(number_of_options: 12)
        expect(equity_grant_exercise_request).to be_valid
      end
    end
  end

  describe "#total_cost_cents" do
    let(:equity_grant_exercise_request) { build(:equity_grant_exercise_request, exercise_price_usd: 100, number_of_options: 10) }

    it "returns the total cost in cents" do
      expect(equity_grant_exercise_request.total_cost_cents).to eq(1_000_00)
    end
  end
end
