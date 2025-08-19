# frozen_string_literal: true

RSpec.describe CompanyUpdate do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:title) }
    it { is_expected.to validate_presence_of(:body) }
  end

  describe "#status" do
    let(:company_update) { build(:company_update) }

    context "when sent_at is present" do
      before { company_update.sent_at = Time.current }

      it "returns 'Sent'" do
        expect(company_update.status).to eq("Sent")
      end
    end

    context "when sent_at is nil" do
      before { company_update.sent_at = nil }

      it "returns 'Draft'" do
        expect(company_update.status).to eq("Draft")
      end
    end
  end
end
