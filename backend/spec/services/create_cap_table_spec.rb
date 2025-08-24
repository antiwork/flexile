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
      end

      it "creates share class if it doesn't exist" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        share_class = company.share_classes.last
        expect(share_class.name).to eq(ShareClass::DEFAULT_NAME)
        expect(share_class.original_issue_price_in_dollars).to be_nil
      end

      it "creates company investors" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        alice_investor = company.company_investors.find_by(user: user1)
        bob_investor = company.company_investors.find_by(user: user2)

        expect(alice_investor.total_shares).to eq(100_000)
        expect(bob_investor.total_shares).to eq(50_000)
        expect(alice_investor.investment_amount_in_cents).to eq(100_000_000)
        expect(bob_investor.investment_amount_in_cents).to eq(50_000_000)
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
        expect(alice_holding.name).to match(/\A[A-Z]{3}-\d+\z/)
      end

      it "generates sequential share names using company prefix" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        alice_investor = company.company_investors.find_by(user: user1)
        bob_investor = company.company_investors.find_by(user: user2)

        alice_holding = alice_investor.share_holdings.first
        bob_holding = bob_investor.share_holdings.first

        company_prefix = company.name.first(3).upcase
        expect(alice_holding.name).to eq("#{company_prefix}-1")
        expect(bob_holding.name).to eq("#{company_prefix}-2")
      end

      it "uses option_holder_name logic for share_holder_name" do
        service = described_class.new(company: company, investors_data: investors_data)
        service.perform

        alice_investor = company.company_investors.find_by(user: user1)
        alice_holding = alice_investor.share_holdings.first

        # Should use legal_name for regular users (since business_entity? is false by default)
        expect(alice_holding.share_holder_name).to eq("Alice Johnson")
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

      it "returns error when user is already an investor" do
        create(:company_investor, company: company, user: user1)
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])

        result = service.perform

        expect(result[:success]).to be false
        expect(result[:errors]).to include("Company already has cap table data: investors")
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

    context "with existing share class" do
      let!(:share_class) { create(:share_class, company: company, name: ShareClass::DEFAULT_NAME) }

      it "doesn't create duplicate share class" do
        service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
        service.perform

        expect(company.share_classes.count).to eq(1)
      end
    end

    context "when company already has cap table data" do
      context "when company has existing option pools" do
        it "returns error when trying to create cap table after option pool already exists" do
          # First, create an option pool in the company
          create(:option_pool, company: company)

          # Then try to create cap table - should fail
          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data: option pools")
        end
      end

      context "when company has existing share classes" do
        it "returns error when trying to create cap table after share class already exists" do
          # First, create a share class in the company
          create(:share_class, company: company, name: "Series A")

          # Then try to create cap table - should fail
          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data: share classes")
        end
      end

      context "when company has existing company investors" do
        it "returns error when trying to create cap table after investors already exist" do
          # First, create an investor in the company
          create(:company_investor, company: company)

          # Then try to create cap table - should fail
          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data: investors")
        end
      end

      context "when company has existing share holdings" do
        it "returns error when trying to create cap table after share holdings already exist" do
          # First, create share holdings in the company
          user = create(:user)
          company_investor = create(:company_investor, company: company, user: user)
          create(:share_holding, company_investor: company_investor)

          # Then try to create cap table - should fail
          service = described_class.new(company: company, investors_data: [{ userId: user1.external_id, shares: 1000 }])
          result = service.perform

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Company already has cap table data: share classes, investors, and share holdings")
        end
      end
    end
  end
end
