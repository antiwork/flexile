# frozen_string_literal: true

RSpec.describe EquityGrantExercise do
  describe "associations" do
    it { is_expected.to belong_to(:bank_account).class_name("EquityExerciseBankAccount").optional(true) }
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to have_one_attached(:contract) }
    it { is_expected.to have_many(:equity_grant_exercise_requests) }
    it { is_expected.to have_many(:equity_grants).through(:equity_grant_exercise_requests) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:requested_at) }
    it { is_expected.to validate_presence_of(:number_of_options) }
    it { is_expected.to validate_numericality_of(:number_of_options).is_greater_than_or_equal_to(1).only_integer }
    it { is_expected.to validate_presence_of(:total_cost_cents) }
    it { is_expected.to validate_numericality_of(:total_cost_cents).is_greater_than_or_equal_to(1).only_integer }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(EquityGrantExercise::ALL_STATUSES) }
    it { is_expected.to validate_presence_of(:bank_reference) }
  end

  describe "callbacks" do
    describe "#set_company" do
      let(:company) { create(:company) }
      let(:company_investor) { create(:company_investor, company:) }
      let(:equity_grant_exercise) { build(:equity_grant_exercise, company_investor:, company: nil) }

      it "sets company_id on create" do
        equity_grant_exercise.save!

        expect(equity_grant_exercise.company_id).to eq(company.id)
      end
    end
  end

  describe "scopes" do
    describe ".signed" do
      let!(:signed_exercise) { create(:equity_grant_exercise, :signed) }
      let!(:pending_exercise) { create(:equity_grant_exercise) }

      it "returns signed exercises" do
        expect(described_class.signed).to eq([signed_exercise])
      end
    end
  end
end
