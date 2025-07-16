# frozen_string_literal: true

RSpec.describe LiquidationScenario do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:liquidation_payouts).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:exit_amount_cents) }
    it { is_expected.to validate_presence_of(:exit_date) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_numericality_of(:exit_amount_cents).is_greater_than(0).only_integer }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w[draft final]) }
  end

  describe "concerns" do
    it "includes ExternalId" do
      expect(described_class.ancestors).to include(ExternalId)
    end

    it "generates an external_id on creation" do
      scenario = create(:liquidation_scenario)
      expect(scenario.external_id).to be_present
      expect(scenario.external_id.length).to eq(13)
    end
  end

  describe "paper_trail" do
    it "tracks changes" do
      scenario = create(:liquidation_scenario)
      expect(scenario.versions.count).to eq(1)
      
      scenario.update!(name: "New scenario name")
      expect(scenario.versions.count).to eq(2)
    end
  end
end