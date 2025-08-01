# frozen_string_literal: true

RSpec.describe Onetime::PopulateCompanyInvestorEntities do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:company_investor1) { create(:company_investor, company:) }
    let(:company_investor2) { create(:company_investor, company:) }
    let(:company_investor3) { create(:company_investor, company:) }

    let!(:share_holding1) do
      create(:share_holding,
             company_investor: company_investor1,
             company_investor_entity: nil,
             share_holder_name: company_investor1.user.legal_name,
             number_of_shares: 100,
             total_amount_in_cents: 10_000)
    end

    let!(:share_holding2) do
      create(:share_holding,
             company_investor: company_investor2,
             company_investor_entity: nil,
             share_holder_name: company_investor2.user.legal_name,
             number_of_shares: 200,
             total_amount_in_cents: 20_000)
    end

    let!(:equity_grant1) do
      create(:equity_grant,
             company_investor: company_investor1,
             company_investor_entity: nil,
             option_holder_name: company_investor1.user.legal_name,
             number_of_shares: 50)
    end

    let!(:equity_grant2) do
      create(:equity_grant,
             company_investor: company_investor2,
             company_investor_entity: nil,
             option_holder_name: company_investor2.user.legal_name,
             number_of_shares: 75)
    end

    let!(:equity_grant3) do
      create(:equity_grant,
             company_investor: company_investor3,
             company_investor_entity: nil,
             option_holder_name: company_investor3.user.legal_name,
             number_of_shares: 100)
    end

    subject(:service) { described_class.new }

    it "creates CompanyInvestorEntities for each unique investor" do
      expect { service.perform }.to change(CompanyInvestorEntity, :count).by(3)
    end

    it "sets the correct attributes on the CompanyInvestorEntities" do
      service.perform
      entities = CompanyInvestorEntity.all

      expect(entities.find_by(name: company_investor1.user.legal_name)).to have_attributes(
        company: company,
        investment_amount_cents: 10_000,
        total_shares: 100,
        total_options: 50,
        email: company_investor1.user.email
      )

      expect(entities.find_by(name: company_investor2.user.legal_name)).to have_attributes(
        company: company,
        investment_amount_cents: 20_000,
        total_shares: 200,
        total_options: 75,
        email: company_investor2.user.email
      )

      expect(entities.find_by(name: company_investor3.user.legal_name)).to have_attributes(
        company: company,
        investment_amount_cents: 0,
        total_shares: 0,
        total_options: 100,
        email: company_investor3.user.email
      )
    end

    it "updates all ShareHoldings with the new CompanyInvestorEntities" do
      service.perform
      [share_holding1, share_holding2].each(&:reload)

      expect(share_holding1.company_investor_entity).to eq(CompanyInvestorEntity.find_by(name: company_investor1.user.legal_name))
      expect(share_holding2.company_investor_entity).to eq(CompanyInvestorEntity.find_by(name: company_investor2.user.legal_name))
    end

    it "updates all EquityGrants with the new CompanyInvestorEntities" do
      service.perform
      [equity_grant1, equity_grant2, equity_grant3].each(&:reload)

      expect(equity_grant1.company_investor_entity).to eq(CompanyInvestorEntity.find_by(name: company_investor1.user.legal_name))
      expect(equity_grant2.company_investor_entity).to eq(CompanyInvestorEntity.find_by(name: company_investor2.user.legal_name))
      expect(equity_grant3.company_investor_entity).to eq(CompanyInvestorEntity.find_by(name: company_investor3.user.legal_name))
    end

    context "when there are multiple ShareHoldings and EquityGrants for the same entity" do
      let!(:another_share_holding) do
        create(:share_holding,
               company_investor: company_investor1,
               company_investor_entity: nil,
               share_holder_name: company_investor1.user.legal_name,
               number_of_shares: 150,
               total_amount_in_cents: 15_000)
      end

      let!(:another_equity_grant) do
        create(:equity_grant,
               company_investor: company_investor1,
               company_investor_entity: nil,
               option_holder_name: company_investor1.user.legal_name,
               number_of_shares: 25)
      end

      it "aggregates the data correctly" do
        service.perform
        entity = CompanyInvestorEntity.find_by(name: company_investor1.user.legal_name)

        expect(entity.investment_amount_cents).to eq(25_000)
        expect(entity.total_shares).to eq(250)
        expect(entity.total_options).to eq(75)
      end

      it "updates all ShareHoldings and EquityGrants for the same entity" do
        service.perform
        entity = CompanyInvestorEntity.find_by(name: company_investor1.user.legal_name)

        [share_holding1, another_share_holding, equity_grant1, another_equity_grant].each do |record|
          record.reload
          expect(record.company_investor_entity).to eq(entity)
        end
      end
    end

    context "when there are multiple companies" do
      let(:another_company) { create(:company) }
      let(:another_company_investor) { create(:company_investor, company: another_company) }
      let!(:another_share_holding) do
        create(:share_holding,
               company_investor: another_company_investor,
               company_investor_entity: nil,
               share_holder_name: another_company_investor.user.legal_name,
               number_of_shares: 300,
               total_amount_in_cents: 30_000)
      end

      it "creates separate CompanyInvestorEntities for each company" do
        expect { service.perform }.to change(CompanyInvestorEntity, :count).by(4)
      end

      it "associates the correct data with each CompanyInvestorEntity" do
        service.perform
        entity1 = CompanyInvestorEntity.find_by(company: company, name: company_investor1.user.legal_name)
        entity2 = CompanyInvestorEntity.find_by(company: another_company)

        expect(entity1).to have_attributes(
          total_shares: 100,
          email: company_investor1.user.email
        )
        expect(entity2).to have_attributes(
          total_shares: 300,
          email: another_company_investor.user.email
        )
      end
    end


    context "when an investor has no shares but has options" do
      let(:options_only_investor) { create(:company_investor, company: company) }
      let!(:options_only_grant) do
        create(:equity_grant,
               company_investor: options_only_investor,
               company_investor_entity: nil,
               option_holder_name: options_only_investor.user.legal_name,
               number_of_shares: 100)
      end

      it "creates a CompanyInvestorEntity with correct attributes" do
        service.perform
        entity = CompanyInvestorEntity.find_by(name: options_only_investor.user.legal_name)

        expect(entity).to have_attributes(
          company: company,
          investment_amount_cents: 0,
          total_shares: 0,
          total_options: 100,
          email: options_only_investor.user.email
        )
      end
    end

    context "when multiple company investors have the same option_holder_name" do
      let(:company_investor4) { create(:company_investor, company: company) }
      let(:company_investor5) { create(:company_investor, company: company) }
      let(:shared_name) { "John Doe" }

      let!(:equity_grant4) do
        create(:equity_grant,
               company_investor: company_investor4,
               company_investor_entity: nil,
               option_holder_name: shared_name,
               number_of_shares: 100)
      end

      let!(:equity_grant5) do
        create(:equity_grant,
               company_investor: company_investor5,
               company_investor_entity: nil,
               option_holder_name: shared_name,
               number_of_shares: 200)
      end

      it "creates only one CompanyInvestorEntity for the shared name" do
        expect do
          service.perform
        end.to change(CompanyInvestorEntity, :count).by(4) # 3 from previous tests + 1 for the shared name
        shared_entity = CompanyInvestorEntity.find_by(name: shared_name)
        expect(shared_entity).to have_attributes(
          company: company,
          investment_amount_cents: 0,
          total_shares: 0,
          total_options: 300, # Sum of shares from both equity grants
          email: company_investor4.user.email
        )
        [equity_grant4, equity_grant5].each do |grant|
          expect(grant.reload.company_investor_entity).to eq(shared_entity)
        end
      end
    end
  end
end
