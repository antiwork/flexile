# frozen_string_literal: true

RSpec.describe Integration do
  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.include?(Deletable)).to eq(true)
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:integration_records) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:company) }
    it { is_expected.to validate_presence_of(:account_id) }
    it { is_expected.to validate_presence_of(:access_token) }
    it { is_expected.to define_enum_for(:status)
                          .with_values(described_class.statuses)
                          .backed_by_column_of_type(:enum)
                          .with_prefix(:status) }

    context "when no other alive integration exists for the company" do
      it "creates a new integration" do
        integration_1 = create(:integration, :deleted)
        integration_2 = build(:integration, company: integration_1.company)
        expect { integration_2.save! }.to change { Integration.count }.by(1)
      end
    end

    context "when another alive integration exists for the company" do
      it "raises an ActiveRecord::RecordInvalid exception" do
        integration_1 = create(:integration)
        integration_2 = build(:integration, company: integration_1.company)
        expect { integration_2.save! }.to raise_error(ActiveRecord::RecordInvalid, /Type has already been taken/)
      end
    end
  end

  describe "#as_json" do
    context "when integration is initialized" do
      let(:integration) { create(:integration) }

      it "returns JSON representation" do
        expect(integration.as_json).to eq({
          id: integration.id,
          status: "initialized",
          last_sync_at: nil,
        })
      end
    end

    context "when integration is active" do
      let(:integration) { create(:integration, :active) }

      it "returns JSON representation", :freeze_time do
        expect(integration.as_json).to eq({
          id: integration.id,
          status: "active",
          last_sync_at: Time.current.iso8601,
        })
      end
    end
  end
end
