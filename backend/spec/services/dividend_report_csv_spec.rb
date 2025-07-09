# frozen_string_literal: true

RSpec.describe DividendReportCsv do
  def extract(column, rows, row: 1)
    header_map = {
      "date_initiated" => "Date initiated",
      "date_paid" => "Date paid",
      "client_name" => "Client name",
      "total_dividends" => "Total dividends ($)",
      "flexile_fees" => "Flexile fees ($)",
      "transfer_fees" => "Transfer fees ($)",
      "total_ach_pull" => "Total ACH pull ($)",
      "number_of_investors" => "Number of investors",
      "dividend_round_status" => "Dividend round status",
    }
    col_name = header_map[column.to_s] || column.to_s
    col_index = DividendReportCsv::HEADERS.index(col_name)
    raise "Unknown column: #{column}" unless col_index
    rows[row][col_index]
  end

  describe "#generate" do
    let(:company) { create(:company, name: "TestCo") }
    let(:dividend_round) { create(:dividend_round, company:, issued_at: Date.new(2024, 6, 1), status: "Issued") }

    context "with a single paid dividend" do
      let!(:dividend) do
        create(:dividend, :paid, dividend_round:, company:, total_amount_in_cents: 100_00, paid_at: Date.new(2024, 6, 2))
      end
      let!(:dividend_payment) do
        create(:dividend_payment, dividends: [dividend], transfer_fee_in_cents: 300, status: Payments::Status::SUCCEEDED)
      end

      it "generates a CSV with correct headers and values" do
        csv = described_class.new([dividend_round]).generate
        rows = CSV.parse(csv)
        expect(rows[0]).to eq DividendReportCsv::HEADERS
        expect(extract(:date_initiated, rows)).to eq "6/1/2024"
        expect(extract(:date_paid, rows)).to eq "6/2/2024"
        expect(extract(:client_name, rows)).to eq "TestCo"
        expect(extract(:total_dividends, rows).to_f).to eq 100.0
        expect(extract(:flexile_fees, rows).to_f).to eq 3.2
        expect(extract(:transfer_fees, rows).to_f).to eq 3.0
        expect(extract(:total_ach_pull, rows).to_f).to eq 103.2
        expect(extract(:number_of_investors, rows).to_i).to eq 1
        expect(extract(:dividend_round_status, rows)).to eq "Issued"
      end
    end

    context "with multiple dividends and payments" do
      let!(:dividend1) do
        create(:dividend, :paid, dividend_round:, company:, total_amount_in_cents: 200_00, paid_at: Date.new(2024, 6, 2))
      end
      let!(:dividend2) do
        create(:dividend, :paid, dividend_round:, company:, total_amount_in_cents: 300_00, paid_at: Date.new(2024, 6, 2))
      end
      let!(:dividend_payment1) do
        create(:dividend_payment, dividends: [dividend1], transfer_fee_in_cents: 100, status: Payments::Status::SUCCEEDED)
      end
      let!(:dividend_payment2) do
        create(:dividend_payment, dividends: [dividend2], transfer_fee_in_cents: 200, status: Payments::Status::SUCCEEDED)
      end
      let!(:failed_dividend_payment1) do
        create(:dividend_payment, dividends: [dividend1], transfer_fee_in_cents: 100, status: Payments::Status::FAILED)
      end
      let!(:failed_dividend_payment2) do
        create(:dividend_payment, dividends: [dividend2], transfer_fee_in_cents: 200, status: Payments::Status::FAILED)
      end

      it "sums up all dividends and fees correctly" do
        csv = described_class.new([dividend_round]).generate
        rows = CSV.parse(csv)
        expect(extract(:total_dividends, rows).to_f).to eq 500.0
        expect(extract(:flexile_fees, rows).to_f).to eq 15.1
        expect(extract(:transfer_fees, rows).to_f).to eq 3.0
        expect(extract(:total_ach_pull, rows).to_f).to eq (500.0 + 15.1)
        expect(extract(:number_of_investors, rows).to_i).to eq 2
      end
    end

    context "with no dividends" do
      it "outputs zeroes and nils appropriately" do
        csv = described_class.new([dividend_round]).generate
        rows = CSV.parse(csv)
        expect(extract(:total_dividends, rows).to_f).to eq 0.0
        expect(extract(:flexile_fees, rows).to_f).to eq 0.0
        expect(extract(:transfer_fees, rows).to_f).to eq 0.0
        expect(extract(:total_ach_pull, rows).to_f).to eq 0.0
        expect(extract(:number_of_investors, rows).to_i).to eq 0
      end
    end

    context "with unpaid dividends only" do
      let!(:dividend) do
        create(:dividend, dividend_round:, company:, total_amount_in_cents: 100_00, status: Dividend::ISSUED)
      end
      it "outputs zeroes for paid fields and counts unpaid dividends" do
        csv = described_class.new([dividend_round]).generate
        rows = CSV.parse(csv)
        expect(extract(:date_paid, rows)).to be_nil
        expect(extract(:total_dividends, rows).to_f).to eq 100.0
        expect(extract(:number_of_investors, rows).to_i).to eq 1
      end
    end

    context "with flexile fee cap" do
      let!(:dividend) do
        create(:dividend, :paid, dividend_round:, company:, total_amount_in_cents: 200_000_00, paid_at: Date.new(2024, 6, 2))
      end
      let!(:dividend_payment) do
        create(:dividend_payment, dividends: [dividend], transfer_fee_in_cents: 100, status: Payments::Status::SUCCEEDED)
      end
      it "caps flexile fee at $30" do
        csv = described_class.new([dividend_round]).generate
        rows = CSV.parse(csv)
        expect(extract(:flexile_fees, rows).to_f).to eq 30.0
      end
    end

    context "with multiple dividend rounds" do
      let(:company2) { create(:company, name: "OtherCo") }
      let(:dividend_round2) { create(:dividend_round, company: company2, issued_at: Date.new(2024, 5, 1), status: "Paid") }
      let!(:dividend1) { create(:dividend, :paid, dividend_round:, company:, total_amount_in_cents: 100_00, paid_at: Date.new(2024, 6, 2)) }
      let!(:dividend2) { create(:dividend, :paid, dividend_round: dividend_round2, company: company2, total_amount_in_cents: 50_00, paid_at: Date.new(2024, 5, 2)) }
      it "outputs a row for each round" do
        csv = described_class.new([dividend_round, dividend_round2]).generate
        rows = CSV.parse(csv)
        expect(rows.size).to eq 3 # header + 2 rows
        expect(extract(:client_name, rows, row: 1)).to eq "TestCo"
        expect(extract(:client_name, rows, row: 2)).to eq "OtherCo"
      end
    end
  end
end
