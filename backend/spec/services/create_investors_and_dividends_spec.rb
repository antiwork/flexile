# frozen_string_literal: true

require "rails_helper"

RSpec.describe CreateInvestorsAndDividends do
  let(:company) { create(:company) }
  let(:dividend_date) { Date.new(2024, 6, 15) }
  let(:csv_data) do
    <<~CSV
      name,full_legal_name,investment_address_1,investment_address_2,investment_address_city,investment_address_region,investment_address_postal_code,investment_address_country,email,investment_date,investment_amount,tax_id,entity_name,dividend_amount
      John Doe,John Michael Doe,123 Main St,,San Francisco,CA,94102,US,john@example.com,2024-01-15,10000.00,123-45-6789,,500.00
      Jane Smith,Jane Elizabeth Smith,456 Oak Ave,Apt 2B,New York,NY,10001,US,jane@example.com,2024-02-20,25000.00,987-65-4321,,1250.00
      Business Corp,Business Corp LLC,789 Corporate Blvd,,Austin,TX,73301,US,business@example.com,2024-03-10,50000.00,12-3456789,Business Corp LLC,2500.00
    CSV
  end

  describe "#initialize" do
    it "initializes with required parameters" do
      service = described_class.new(
        company_id: company.id,
        csv_data: csv_data,
        dividend_date: dividend_date
      )

      expect(service).to be_present
      expect(service.errors).to eq([])
    end

    it "accepts optional parameters" do
      service = described_class.new(
        company_id: company.id,
        csv_data: csv_data,
        dividend_date: dividend_date,
        is_first_round: true,
        is_return_of_capital: true
      )

      expect(service).to be_present
    end
  end

  describe "#process" do
    let(:service) do
      described_class.new(
        company_id: company.id,
        csv_data: csv_data,
        dividend_date: dividend_date
      )
    end

    context "with valid CSV data" do
      it "processes CSV data successfully" do
        expect { service.process }.not_to raise_error
      end

      it "creates investors from CSV data" do
        expect { service.process }.to change { User.count }.by(3)
      end

      it "creates company investors" do
        expect { service.process }.to change { CompanyInvestor.count }.by(3)
      end

      it "creates investments" do
        expect { service.process }.to change { Investment.count }.by(3)
      end

      it "creates dividend round" do
        expect { service.process }.to change { DividendRound.count }.by(1)
      end

      it "creates dividends" do
        expect { service.process }.to change { Dividend.count }.by(3)
      end

      it "parses user data correctly" do
        service.process

        user = User.find_by(email: "john@example.com")
        expect(user.preferred_name).to eq("John Doe")
        expect(user.legal_name).to eq("John Michael Doe")
        expect(user.street_address).to eq("123 Main St")
        expect(user.city).to eq("San Francisco")
        expect(user.state).to eq("CA")
        expect(user.zip_code).to eq("94102")
        expect(user.country_code).to eq("US")
        expect(user.business_entity).to be_falsey
      end

      it "parses business entity data correctly" do
        service.process

        user = User.find_by(email: "business@example.com")
        expect(user.business_entity).to be_truthy
        expect(user.business_name).to eq("Business Corp LLC")
      end

      it "creates investments with correct amounts" do
        service.process

        investment = Investment.joins(:user).find_by(users: { email: "john@example.com" })
        expect(investment.amount_in_cents).to eq(1_000_000) # $10,000.00
      end

      it "creates dividends with correct amounts" do
        service.process

        dividend = Dividend.joins(:user).find_by(users: { email: "jane@example.com" })
        expect(dividend.amount_in_cents).to eq(125_000) # $1,250.00
      end
    end

    context "with invalid CSV data" do
      let(:invalid_csv_data) do
        <<~CSV
          name,email
          John Doe,
          ,jane@example.com
        CSV
      end

      let(:service) do
        described_class.new(
          company_id: company.id,
          csv_data: invalid_csv_data,
          dividend_date: dividend_date
        )
      end

      it "skips rows with blank emails" do
        expect { service.process }.to change { User.count }.by(1)
      end

      it "handles missing data gracefully" do
        expect { service.process }.not_to raise_error
      end
    end

    context "with existing users" do
      let!(:existing_user) { create(:user, email: "john@example.com") }

      it "does not create duplicate users" do
        expect { service.process }.to change { User.count }.by(2)
      end

      it "still creates company investor for existing user" do
        expect { service.process }.to change { CompanyInvestor.count }.by(3)
      end
    end

    context "with malformed CSV" do
      let(:malformed_csv) { "invalid,csv\ndata" }

      let(:service) do
        described_class.new(
          company_id: company.id,
          csv_data: malformed_csv,
          dividend_date: dividend_date
        )
      end

      it "handles malformed CSV gracefully" do
        expect { service.process }.not_to raise_error
      end
    end
  end
end
