# frozen_string_literal: true

RSpec.describe CreateInvestorsAndDividends do
  let(:company) { create(:company) }
  let!(:company_admin) { create(:company_administrator, company: company) }
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
        dividend_date: dividend_date,
        is_first_round: true
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

      it "creates dividend round" do
        expect { service.process }.to change { DividendRound.count }.by(1)
      end

      it "creates dividends" do
        expect { service.process }.to change { Dividend.count }.by(3)
      end

      it "parses user data correctly" do
        service.process

        user = User.find_by("email LIKE 'sharang.d+12345%@gmail.com'")
        expect(user).to be_present
        expect(user.preferred_name).to eq("John Doe")
        expect(user.legal_name).to eq("John Michael Doe")
        expect(user.street_address).to eq("123 Main St")
        expect(user.city).to eq("San Francisco")
        expect(user.state).to eq("CA")
        expect(user.zip_code).to eq("94102")
        expect(user.country_code).to eq("US")
        expect(user.business_entity).to be_falsey
      end

      it "parses address data with multiple address lines correctly" do
        service.process

        user = User.where("email LIKE 'sharang.d+12345%@gmail.com'").find_by("preferred_name = 'Jane Smith'")
        expect(user).to be_present
        expect(user.street_address).to eq("456 Oak Ave, Apt 2B")
        expect(user.city).to eq("New York")
        expect(user.state).to eq("NY")
        expect(user.zip_code).to eq("10001")
        expect(user.country_code).to eq("US")
      end

      it "creates investment records with correct dates and amounts" do
        service.process

        user = User.find_by("email LIKE 'sharang.d+12345%@gmail.com'")
        company_investor = user.company_investors.find_by(company: company)
        expect(company_investor.investment_amount_in_cents).to eq(1_000_000) # $10,000.00

        # Verify dividend round attributes
        dividend_round = company.dividend_rounds.first
        expect(dividend_round.total_amount_in_cents).to eq(425_000) # $4,250.00 total
        expect(dividend_round.number_of_shareholders).to eq(3)
        expect(dividend_round.status).to eq(Dividend::ISSUED)
      end

      it "parses business entity data correctly" do
        service.process

        user = User.where("email LIKE 'sharang.d+12345%@gmail.com'").find_by("preferred_name = 'Business Corp'")
        expect(user).to be_present
        expect(user.business_entity).to be_truthy
        expect(user.business_name).to eq("Business Corp LLC")
      end

      it "creates company investors with correct amounts" do
        service.process

        user = User.find_by("email LIKE 'sharang.d+12345%@gmail.com'")
        company_investor = user.company_investors.find_by(company: company)
        expect(company_investor.investment_amount_in_cents).to eq(1_000_000) # $10,000.00
      end

      it "creates dividends with correct amounts and attributes" do
        service.process

        user = User.where("email LIKE 'sharang.d+12345%@gmail.com'").find_by("preferred_name = 'Jane Smith'")
        company_investor = user.company_investors.find_by(company: company)
        dividend = company_investor.dividends.first
        expect(dividend.total_amount_in_cents).to eq(125_000) # $1,250.00
        expect(dividend.status).to eq(Dividend::PENDING_SIGNUP)
        expect(dividend.company).to eq(company)
        expect(dividend.dividend_round).to be_present
      end

      it "creates business entity users with correct attributes" do
        service.process

        business_user = User.where("email LIKE 'sharang.d+12345%@gmail.com'").find_by("preferred_name = 'Business Corp'")
        expect(business_user).to be_present
        expect(business_user.business_entity).to be_truthy
        expect(business_user.business_name).to eq("Business Corp LLC")
        expect(business_user.legal_name).to eq("Business Corp LLC")
        expect(business_user.street_address).to eq("789 Corporate Blvd")
        expect(business_user.city).to eq("Austin")
        expect(business_user.state).to eq("TX")

        # Verify investment amount for business entity
        company_investor = business_user.company_investors.find_by(company: company)
        expect(company_investor.investment_amount_in_cents).to eq(5_000_000) # $50,000.00

        # Verify dividend amount for business entity
        dividend = company_investor.dividends.first
        expect(dividend.total_amount_in_cents).to eq(250_000) # $2,500.00
      end
    end

    context "with invalid CSV data" do
      let(:invalid_csv_data) do
        <<~CSV
          name,full_legal_name,investment_address_1,investment_address_2,investment_address_city,investment_address_region,investment_address_postal_code,investment_address_country,email,investment_date,investment_amount,tax_id,entity_name,dividend_amount
          John Doe,John Michael Doe,123 Main St,,San Francisco,CA,94102,US,,2024-01-15,10000.00,123-45-6789,,500.00
          Jane Smith,Jane Elizabeth Smith,456 Oak Ave,Apt 2B,New York,NY,10001,US,jane@example.com,2024-02-20,25000.00,987-65-4321,,1250.00
        CSV
      end

      let(:service) do
        described_class.new(
          company_id: company.id,
          csv_data: invalid_csv_data,
          dividend_date: dividend_date,
          is_first_round: true
        )
      end

      it "skips rows with blank emails" do
        expect { service.process }.to change { User.count }.by(1)
      end

      it "handles missing data gracefully" do
        expect { service.process }.not_to raise_error
        expect(DividendRound.count).to eq(1) # One dividend round created for valid row
      end
    end

    context "with existing users" do
      let!(:existing_user) { create(:user, email: "sharang.d+123450@gmail.com") }

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
        expect(DividendRound.count).to eq(0) # No dividend round created due to no valid data
      end
    end
  end
end
