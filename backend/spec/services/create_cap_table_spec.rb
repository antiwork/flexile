# frozen_string_literal: true

RSpec.describe CreateCapTable do
  let(:company) { create(:company, name: "Test Company", equity_enabled: true, share_price_in_usd: 10.0, fully_diluted_shares: 0) }
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

        share_class = company.share_classes.last
        expect(share_class.name).to eq(ShareClass::DEFAULT_NAME)
        expect(share_class.original_issue_price_in_dollars).to be_nil

        alice_investor = company.company_investors.find_by(user: user1)
        bob_investor = company.company_investors.find_by(user: user2)

        expect(alice_investor.total_shares).to eq(100_000)
        expect(bob_investor.total_shares).to eq(50_000)
        expect(alice_investor.investment_amount_in_cents).to eq(100_000_000)
        expect(bob_investor.investment_amount_in_cents).to eq(50_000_000)

        alice_holding = alice_investor.share_holdings.first
        bob_holding = bob_investor.share_holdings.first

        expect(alice_holding.number_of_shares).to eq(100_000)
        expect(alice_holding.share_price_usd).to eq(10.0)
        expect(alice_holding.total_amount_in_cents).to eq(100_000_000)
        expect(alice_holding.share_holder_name).to eq("Alice Johnson")
        expect(alice_holding.name).to match(/\A[A-Z]{3}-\d+\z/)

        company_prefix = company.name.first(3).upcase
        expect(alice_holding.name).to eq("#{company_prefix}-1")
        expect(bob_holding.name).to eq("#{company_prefix}-2")

        expect(company.reload.fully_diluted_shares).to eq(150_000)
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

      it "returns error when user is already an investor" do
        create(:company_investor, company: company, user: user1)
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Company already has cap table data")
      end

      it "returns error when user is not found" do
        service = described_class.new(company: company, investors_data: [{ userId: "non-existent-user-id", shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Investor 1: User not found")
      end

      it "returns error when total shares exceed company limit" do
        company.update!(fully_diluted_shares: 50_000)
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 100_000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Total shares (100000) cannot exceed company's fully diluted shares (50000)")
      end
    end

    context "when company already has cap table data" do
      context "when company has existing option pools" do
        it "returns error when trying to create cap table after option pool already exists" do
          create(:option_pool, company: company)

          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data")
        end
      end

      context "when company has existing share classes" do
        it "returns error when trying to create cap table after share class already exists" do
          create(:share_class, company: company, name: "Series A")

          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data")
        end
      end

      context "when company has existing company investors" do
        it "returns error when trying to create cap table after investors already exist" do
          create(:company_investor, company: company)

          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data")
        end
      end

      context "when company has existing share holdings" do
        it "returns error when trying to create cap table after share holdings already exist" do
          user = create(:user)
          company_investor = create(:company_investor, company: company, user: user)
          create(:share_holding, company_investor: company_investor)

          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data")
        end
      end
    end
  end
end
