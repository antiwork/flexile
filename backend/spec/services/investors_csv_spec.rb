# frozen_string_literal: true

RSpec.describe InvestorsCsv do
  let(:company) { create(:company, fully_diluted_shares: 12_000_000) }
  let(:cap_table_service) { instance_double(CapTableService) }
  let(:service) { described_class.new(company:, user_role:, new_schema: false) }

  let(:mock_data) do
    {
      investors: [
        {
          id: "investor1",
          name: "Founder",
          email: "founder@example.com",
          outstanding_shares: 500_123,
          fully_diluted_shares: 500_123,
          shares_by_class: { "Class A" => 500_123, "Class B" => 0, "Common" => 0 },
          options_by_strike: { BigDecimal("4.64") => 0, BigDecimal("10.00") => 0 },
        },
        {
          id: "investor2",
          name: "Partner Example",
          email: "partner@example.com",
          outstanding_shares: 499_877,
          fully_diluted_shares: 499_877,
          shares_by_class: { "Class A" => 0, "Class B" => 400_000, "Common" => 99_877 },
          options_by_strike: { BigDecimal("4.64") => 0, BigDecimal("10.00") => 0 },
        },
        {
          id: "investor3",
          name: "John Doe",
          email: "contractor+1@example.com",
          outstanding_shares: 0,
          fully_diluted_shares: 378_987,
          shares_by_class: { "Class A" => 0, "Class B" => 0, "Common" => 0 },
          options_by_strike: { BigDecimal("4.64") => 192_234, BigDecimal("10.00") => 0 },
        },
        {
          id: "investor4",
          name: "Jane Snow",
          email: "contractor+2@example.com",
          outstanding_shares: 0,
          fully_diluted_shares: 621_013,
          shares_by_class: { "Class A" => 0, "Class B" => 0, "Common" => 0 },
          options_by_strike: { BigDecimal("4.64") => 0, BigDecimal("10.00") => 398_234 },
        },
        {
          name: "Republic.co Crowd SAFE",
          outstanding_shares: nil,
          fully_diluted_shares: nil,
          shares_by_class: { "Class A" => 0, "Class B" => 0, "Common" => 0 },
          options_by_strike: { BigDecimal("4.64") => 0, BigDecimal("10.00") => 0 },
        },
        {
          name: "Options available (2021 Equity Incentive Plan)",
          outstanding_shares: nil,
          fully_diluted_shares: 10_000_000,
          shares_by_class: { "Class A" => 0, "Class B" => 0, "Common" => 0 },
          options_by_strike: { BigDecimal("4.64") => 0, BigDecimal("10.00") => 0 },
        }
      ],
      share_classes: [
        { name: "Class A" },
        { name: "Class B" },
        { name: "Common" }
      ],
      exercise_prices: [BigDecimal("4.64"), BigDecimal("10.00")],
      outstanding_shares: 1_000_000,
      fully_diluted_shares: 12_000_000,
    }
  end

  before do
    allow(CapTableService).to receive(:new).with(company:, new_schema: false).and_return(cap_table_service)
    allow(cap_table_service).to receive(:generate).and_return(mock_data)
  end

  describe "#generate" do
    context "when user is an administrator" do
      let(:user_role) { "administrator" }

      it "generates CSV with correct headers" do
        csv = service.generate

        expected_header = "Name,Outstanding shares,Outstanding ownership (%),Fully diluted shares,Fully diluted ownership (%),Class A,Class B,Common,Common options $4.64 strike,Common options $10.00 strike"
        expect(csv.split("\n").first).to eq(expected_header)
      end

      it "includes investor names with email addresses" do
        csv = service.generate
        lines = csv.split("\n")

        expect(lines[1]).to include("Founder (founder@example.com)")
        expect(lines[2]).to include("Partner Example (partner@example.com)")
        expect(lines[3]).to include("John Doe (contractor+1@example.com)")
        expect(lines[4]).to include("Jane Snow (contractor+2@example.com)")
        expect(lines[5]).to include("Republic.co Crowd SAFE")
        expect(lines[6]).to include("Options available (2021 Equity Incentive Plan)")
      end

      it "calculates ownership percentages correctly" do
        csv = service.generate
        lines = csv.split("\n")

        # Founder: 500_123/1_000_000 = 50.012% outstanding, 500_123/12_000_000 = 4.168% fully diluted
        founder_row = lines[1].split(",")
        expect(founder_row[2]).to eq("50.01") # Outstanding ownership
        expect(founder_row[4]).to eq("4.17") # Fully diluted ownership

        # Partner Example: 499_877/1_000_000 = 49.988% outstanding, 499_877/12_000_000 = 4.166% fully diluted
        partner_row = lines[2].split(",")
        expect(partner_row[2]).to eq("49.99") # Outstanding ownership
        expect(partner_row[4]).to eq("4.17") # Fully diluted ownership

        # John Doe: 0% outstanding, 378_987/12_000_000 = 3.158% fully diluted
        john_row = lines[3].split(",")
        expect(john_row[2]).to eq("0.0") # Outstanding ownership
        expect(john_row[4]).to eq("3.16") # Fully diluted ownership

        # Jane Snow: 0% outstanding, 621_013/12_000_000 = 5.175% fully diluted
        jane_row = lines[4].split(",")
        expect(jane_row[2]).to eq("0.0") # Outstanding ownership
        expect(jane_row[4]).to eq("5.18") # Fully diluted ownership
      end

      it "includes share class data" do
        csv = service.generate
        lines = csv.split("\n")

        founder_row = lines[1].split(",")
        expect(founder_row[5]).to eq("500123") # Class A shares
        expect(founder_row[6]).to eq("0") # Class B shares
        expect(founder_row[7]).to eq("0") # Common shares

        partner_row = lines[2].split(",")
        expect(partner_row[5]).to eq("0") # Class A shares
        expect(partner_row[6]).to eq("400000") # Class B shares
        expect(partner_row[7]).to eq("99877") # Common shares
      end

      it "includes options data" do
        csv = service.generate
        lines = csv.split("\n")

        john_row = lines[3].split(",")
        expect(john_row[8]).to eq("192234") # $4.64 strike options
        expect(john_row[9]).to eq("0") # $10.00 strike options

        jane_row = lines[4].split(",")
        expect(jane_row[8]).to eq("0") # $4.64 strike options
        expect(jane_row[9]).to eq("398234") # $10.00 strike options
      end

      it "handles nil values correctly" do
        csv = service.generate
        lines = csv.split("\n")

        safe_row = lines[5].split(",")
        expect(safe_row[1]).to eq("0") # Outstanding shares (nil)
        expect(safe_row[2]).to eq("0.0") # Outstanding ownership
        expect(safe_row[3]).to eq("0") # Fully diluted shares (nil)
        expect(safe_row[4]).to eq("0.0") # Fully diluted ownership
      end

      it "includes option pools with correct available shares" do
        csv = service.generate
        lines = csv.split("\n")

        pool_row = lines[6].split(",")
        expect(pool_row[1]).to eq("0") # Outstanding shares (nil)
        expect(pool_row[2]).to eq("0.0") # Outstanding ownership
        expect(pool_row[3]).to eq("10000000") # Fully diluted shares (available shares)
        expect(pool_row[4]).to eq("83.33") # Fully diluted ownership (10m/12m)
      end

      it "includes totals row" do
        csv = service.generate
        lines = csv.split("\n")
        totals_row = lines.last.split(",")

        expect(totals_row[0]).to eq("Total")
        expect(totals_row[1]).to eq("1000000") # Outstanding shares
        expect(totals_row[2]).to eq("100") # Outstanding ownership
        expect(totals_row[3]).to eq("12000000") # Fully diluted shares
        expect(totals_row[4]).to eq("100") # Fully diluted ownership
        expect(totals_row[5]).to eq("500123") # Class A
        expect(totals_row[6]).to eq("400000") # Class B
        expect(totals_row[7]).to eq("99877") # Common
        expect(totals_row[8]).to eq("192234") # $4.64 strike options
        expect(totals_row[9]).to eq("398234") # $10.00 strike options
      end
    end

    context "when user is a lawyer" do
      let(:user_role) { "lawyer" }

      it "includes investor names with email addresses" do
        csv = service.generate
        lines = csv.split("\n")

        expect(lines[1]).to include("Founder (founder@example.com)")
        expect(lines[2]).to include("Partner Example (partner@example.com)")
      end
    end

    context "when user is an investor" do
      let(:user_role) { "investor" }

      it "includes investor names without email addresses" do
        csv = service.generate
        lines = csv.split("\n")

        expect(lines[1]).to include("Founder")
        expect(lines[1]).not_to include("founder@example.com")
        expect(lines[2]).to include("Partner Example")
        expect(lines[2]).not_to include("partner@example.com")
      end
    end

    context "when company has no investors" do
      let(:user_role) { "administrator" }

      let(:empty_data) do
        {
          investors: [],
          share_classes: [],
          exercise_prices: [],
          outstanding_shares: 0,
          fully_diluted_shares: 0,
        }
      end

      before do
        allow(cap_table_service).to receive(:generate).and_return(empty_data)
      end

      it "generates CSV with only headers and totals row" do
        csv = service.generate
        lines = csv.split("\n")

        expect(lines.length).to eq(2)
        expect(lines[0]).to eq("Name,Outstanding shares,Outstanding ownership (%),Fully diluted shares,Fully diluted ownership (%)")
        expect(lines[1]).to eq("Total,0,100,0,100")
      end
    end
  end
end
