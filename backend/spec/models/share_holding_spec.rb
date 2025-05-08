# frozen_string_literal: true

RSpec.describe ShareHolding do
  describe "associations" do
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to belong_to(:company_investor_entity).optional }
    it { is_expected.to belong_to(:equity_grant).optional }
    it { is_expected.to belong_to(:share_class) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:originally_acquired_at) }
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_presence_of(:share_price_usd) }
    it { is_expected.to validate_numericality_of(:share_price_usd).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:total_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_in_cents).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:share_holder_name) }

    context "disallows the same share name within the same company" do
      let(:share_holding) { create(:share_holding) }
      let(:company) { share_holding.company_investor.company }
      let(:company_investor) { create(:company_investor, company:) }

      it "validates uniqueness of name" do
        expect(share_holding).to be_valid

        record = build(:share_holding, name: share_holding.name, company_investor:)

        expect(record).not_to be_valid
        expect(record.errors[:name]).to eq(["must be unique across the company"])
      end
    end
  end

  describe "callbacks" do
    describe "updates the investor's total_shares on create" do
      let!(:company_investor) { create(:company_investor) }
      let!(:company_investor_entity) { create(:company_investor_entity, company: company_investor.company) }
      let!(:share_holding) { build(:share_holding, company_investor:, company_investor_entity:, number_of_shares: 23) }

      it "increments total_shares" do
        expect do
          share_holding.save!
        end.to change { company_investor.reload.total_shares }.by(23)
           .and change { company_investor_entity.reload.total_shares }.by(23)
      end
    end

    describe "updates the investor's total_shares on update" do
      let!(:company_investor) { share_holding.company_investor }
      let!(:share_holding) { create(:share_holding, number_of_shares: 100) }

      it "updates total_shares when the number is reduced" do
        expect do
          share_holding.update!(number_of_shares: 10)
        end.to change { company_investor.reload.total_shares }.by(-90)
          .and change { share_holding.company_investor_entity.reload.total_shares }.by(-90)
      end

      it "updates total_shares when the number is increased" do
        expect do
          share_holding.update!(number_of_shares: 1_000)
        end.to change { company_investor.reload.total_shares }.by(900)
          .and change { share_holding.company_investor_entity.reload.total_shares }.by(900)
      end
    end

    describe "updates the investor's total_shares on delete" do
      let!(:company_investor) { share_holding.company_investor }
      let!(:share_holding) { create(:share_holding, number_of_shares: 355) }

      it "decrements total_shares" do
        expect do
          share_holding.destroy!
        end.to change { company_investor.reload.total_shares }.by(-355)
          .and change { share_holding.company_investor_entity.reload.total_shares }.by(-355)
      end
    end

    describe "attempts to create a share certificate on create" do
      let(:share_holding) { build(:share_holding) }

      it "calls `#create_share_certificate`" do
        expect(share_holding).to receive(:create_share_certificate)

        share_holding.save!
      end
    end
  end

  describe "#create_share_certificate" do
    let(:share_holding) { build(:share_holding) }

    it "does not enqueue the PDF generation job when the feature is not active" do
      share_holding.save!

      expect(CreateShareCertificatePdfJob.jobs.count).to eq(0)
    end

    it "enqueues the PDF generation job when the feature is active" do
      Flipper.enable(:share_certificates)

      share_holding.save!

      expect(CreateShareCertificatePdfJob).to have_enqueued_sidekiq_job(ShareHolding.last.id)
    end
  end
end
