# frozen_string_literal: true

RSpec.describe CreateCapTable do
  let(:company) { create(:company, equity_enabled: true, share_price_in_usd: 10.0, fully_diluted_shares: 0) }
  let(:user1) { create(:user, legal_name: "Alice Johnson") }
  let(:user2) { create(:user, legal_name: "Bob Smith") }

  describe "#perform" do
    context "with valid data" do
      let(:investors_data) do
        [
          { userId: user1.external_id, shares: 100_000 },
          { userId: user2.external_id, shares: 50_000 }
        ]
      end

      it "creates cap table successfully" do
        service = described_class.new(company: company, investors_data: investors_data)
        result = service.perform

        expect(result[:success]).to be true
        expect(result[:errors]).to eq([])
      end

      it "creates share class if it doesn't exist" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        share_class = company.share_classes.last
        expect(share_class.name).to eq("Common")
        expect(share_class.original_issue_price_in_dollars).to eq(10.0)
      end

      it "creates company investors" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        alice_investor = company.company_investors.find_by(user: user1)
        bob_investor = company.company_investors.find_by(user: user2)

        expect(alice_investor.total_shares).to eq(100_000)
        expect(bob_investor.total_shares).to eq(50_000)
        expect(alice_investor.investment_amount_in_cents).to eq(100_000_000) # 100k * $10 * 100
        expect(bob_investor.investment_amount_in_cents).to eq(50_000_000) # 50k * $10 * 100
      end

      it "creates share holdings" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        alice_investor = company.company_investors.find_by(user: user1)
        alice_holding = alice_investor.share_holdings.first

        expect(alice_holding.number_of_shares).to eq(100_000)
        expect(alice_holding.share_price_usd).to eq(10.0)
        expect(alice_holding.total_amount_in_cents).to eq(100_000_000)
        expect(alice_holding.share_holder_name).to eq("Alice Johnson")
        expect(alice_holding.name).to match(/A-\d+/)
      end

      it "updates company fully diluted shares" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        expect(company.reload.fully_diluted_shares).to eq(150_000)
      end

      it "doesn't update company shares if already set" do
        company.update!(fully_diluted_shares: 1_000_000)

        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        expect(company.reload.fully_diluted_shares).to eq(1_000_000)
      end
    end

    context "with invalid data" do
      it "returns error when equity is not enabled" do
        company.update!(equity_enabled: false)
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Company must have equity enabled")
      end

      it "returns error when no investors data provided" do
        service = described_class.new(company: company, investors_data: [])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("No investors data provided")
      end

      it "returns error when user is not selected" do
        service = described_class.new(company: company, investors_data: [{ userId: nil, shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Investor 1: User must be selected")
      end

      it "returns error when shares are zero or negative" do
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 0 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Investor 1: Shares must be greater than 0")
      end

      it "returns error when user not found" do
        service = described_class.new(company: company, investors_data: [{ userId: "invalid-id", shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Investor 1: User not found")
      end

      it "returns error when user is already an investor" do
        create(:company_investor, company: company, user: user1)
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Investor 1: User is already an investor in this company")
      end

      it "returns error when total shares exceed company limit" do
        company.update!(fully_diluted_shares: 50_000)
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 100_000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Total shares (100000) cannot exceed company's fully diluted shares (50000)")
      end
    end

    context "with existing share class" do
      let!(:share_class) { create(:share_class, company: company, name: "Common") }

      it "doesn't create duplicate share class" do
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
        service.perform

        expect(company.share_classes.count).to eq(1)
      end
    end
  end
end
