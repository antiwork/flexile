# frozen_string_literal: true

RSpec.describe EquityGrant do
  describe "associations" do
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to belong_to(:company_investor_entity).optional }
    it { is_expected.to belong_to(:option_pool) }
    it { is_expected.to belong_to(:active_exercise).class_name("EquityGrantExercise").optional(true) }
    it { is_expected.to have_one(:contract) }
    it { is_expected.to have_many(:equity_grant_exercise_requests) }
    it { is_expected.to have_many(:exercises).class_name("EquityGrantExercise").through(:equity_grant_exercise_requests) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:expires_at) }
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_numericality_of(:number_of_shares).only_integer.is_greater_than_or_equal_to(1) }
    it { is_expected.to validate_presence_of(:vested_shares) }
    it { is_expected.to validate_numericality_of(:vested_shares).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:unvested_shares) }
    it { is_expected.to validate_numericality_of(:unvested_shares).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:exercised_shares) }
    it { is_expected.to validate_numericality_of(:exercised_shares).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:forfeited_shares) }
    it { is_expected.to validate_numericality_of(:forfeited_shares).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:share_price_usd) }
    it { is_expected.to validate_numericality_of(:share_price_usd).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:exercise_price_usd) }
    it { is_expected.to validate_numericality_of(:exercise_price_usd).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:voluntary_termination_exercise_months) }
    it { is_expected.to validate_numericality_of(:voluntary_termination_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:involuntary_termination_exercise_months) }
    it { is_expected.to validate_numericality_of(:involuntary_termination_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:termination_with_cause_exercise_months) }
    it { is_expected.to validate_numericality_of(:termination_with_cause_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:death_exercise_months) }
    it { is_expected.to validate_numericality_of(:death_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:disability_exercise_months) }
    it { is_expected.to validate_numericality_of(:disability_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:retirement_exercise_months) }
    it { is_expected.to validate_numericality_of(:retirement_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:option_holder_name) }
    it { is_expected.to define_enum_for(:issue_date_relationship).with_values(EquityGrant.issue_date_relationships).backed_by_column_of_type(:enum).with_prefix(:issue_date_relationship) }
    it { is_expected.to define_enum_for(:option_grant_type).with_values(EquityGrant.option_grant_types).backed_by_column_of_type(:enum).with_prefix(:option_grant_type) }

    context "when another record exists" do
      before { create(:equity_grant) }

      it { is_expected.to validate_uniqueness_of(:name).scoped_to(:company_investor_id) }
    end

    context "disallows the same grant name within the same company" do
      let(:equity_grant) { create(:equity_grant) }
      let(:company) { equity_grant.company_investor.company }
      let(:company_investor) { create(:company_investor, company:) }

      it "validates uniqueness of name" do
        expect(equity_grant).to be_valid

        record = build(:equity_grant, name: equity_grant.name, company_investor:)

        expect(record).not_to be_valid
        expect(record.errors[:name]).to eq(["must be unique across the company"])
      end
    end
  end

  describe "scopes" do
    describe ".eventually_exercisable" do
      let(:unexercised_grant) { create(:equity_grant) }
      let(:partially_exercised_grant_1) do
        create(:equity_grant, number_of_shares: 100, vested_shares: 25, unvested_shares: 50, exercised_shares: 25)
      end
      let(:partially_exercised_grant_2) do
        create(:equity_grant, number_of_shares: 100, vested_shares: 20, unvested_shares: 20, exercised_shares: 60)
      end
      let(:partially_exercised_grant_3) do
        create(:equity_grant, number_of_shares: 100, vested_shares: 40, unvested_shares: 0, exercised_shares: 60)
      end

      before do
        # Fully exercised grants
        create(:equity_grant, number_of_shares: 100, vested_shares: 0, unvested_shares: 0, exercised_shares: 100)
        create(:equity_grant, number_of_shares: 100, vested_shares: 0, unvested_shares: 0, exercised_shares: 80, forfeited_shares: 20)
      end

      it "returns only grants that can still be exercised in the future" do
        expect(described_class.eventually_exercisable).to eq([
                                                               unexercised_grant,
                                                               partially_exercised_grant_1,
                                                               partially_exercised_grant_2,
                                                               partially_exercised_grant_3,
                                                             ])
      end
    end

    describe ".accepted" do
      let!(:accepted_grant) { create(:equity_grant) }
      let!(:unaccepted_grant) { create(:equity_grant, accepted_at: nil) }

      it "returns only grants that have been accepted" do
        expect(described_class.accepted).to eq([accepted_grant])
      end
    end
  end

  describe "virtual attributes" do
    let(:equity_grant) do
      create(:equity_grant, number_of_shares: 100, unvested_shares: 40, vested_shares: 60, share_price_usd: 10)
    end

    it "calculates vested_amount_usd" do
      expect(equity_grant.vested_amount_usd).to eq(60 * 10.to_d)
    end
  end

  describe "callbacks" do
    let(:equity_grant) { create(:equity_grant, number_of_shares: 100, vested_shares: 60, unvested_shares: 40) }
    let(:option_pool) { equity_grant.option_pool }
    let(:company_investor) { equity_grant.company_investor }
    let(:company_investor_entity) { equity_grant.company_investor_entity }

    describe "on update" do
      context "when number_of_shares is changed" do
        it "decrements the option pool's issued_shares if the value is reduced" do
          expect do
            equity_grant.update!(number_of_shares: 70, vested_shares: 30)
          end.to change { option_pool.reload.issued_shares }.by(-30)
        end

        it "increments the option pool's issued_shares if the value is increased" do
          expect do
            equity_grant.update!(number_of_shares: 1_000, vested_shares: 960)
          end.to change { option_pool.reload.issued_shares }.by(900)
        end
      end

      context "when vested_shares is changed" do
        it "decrements the company investor's total_options if the value is reduced" do
          expect do
            equity_grant.update!(number_of_shares: 60, vested_shares: 20)
          end.to change { company_investor.reload.total_options }.by(-40)
            .and change { company_investor_entity.reload.total_options }.by(-40)
        end

        it "increments the company investor's total_options if the value is increased" do
          expect do
            equity_grant.update!(number_of_shares: 200, vested_shares: 160)
          end.to change { company_investor.reload.total_options }.by(100)
            .and change { company_investor_entity.reload.total_options }.by(100)
        end
      end

      context "when unvested_shares is changed" do
        it "decrements the company investor's total_options if the value is reduced" do
          expect do
            equity_grant.update!(number_of_shares: 70, unvested_shares: 10)
          end.to change { company_investor.reload.total_options }.by(-30)
            .and change { company_investor_entity.reload.total_options }.by(-30)
        end

        it "increments the company investor's total_options if the value is increased" do
          expect do
            equity_grant.update!(number_of_shares: 250, unvested_shares: 190)
          end.to change { company_investor.reload.total_options }.by(150)
            .and change { company_investor_entity.reload.total_options }.by(150)
        end
      end

      context "when both vested_shares and unvested_shares are changed" do
        it "decrements the company investor's total_options if the sum is reduced" do
          expect do
            equity_grant.update!(number_of_shares: 40, vested_shares: 25, unvested_shares: 15)
          end.to change { company_investor.reload.total_options }.by(-60)
            .and change { company_investor_entity.reload.total_options }.by(-60)
        end

        it "increments the company investor's total_options if the sum is increased" do
          expect do
            equity_grant.update!(number_of_shares: 300, vested_shares: 240, unvested_shares: 60)
          end.to change { company_investor.reload.total_options }.by(200)
            .and change { company_investor_entity.reload.total_options }.by(200)
        end
      end
    end

    describe "on delete" do
      it "decrements total_shares & total_options" do
        expect do
          equity_grant.destroy!
        end.to change { option_pool.reload.issued_shares }.by(-100)
           .and change { company_investor.reload.total_options }.by(-100)
           .and change { company_investor_entity.reload.total_options }.by(-100)
      end
    end
  end
end
