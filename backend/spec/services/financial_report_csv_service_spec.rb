# frozen_string_literal: true

RSpec.describe FinancialReportCsvService do
  let(:company) { create(:company, name: "TestCo") }
  let(:user) { create(:user, legal_name: "John Contractor", email: "john@example.com") }
  let(:investor_user) { create(:user, legal_name: "Jane Investor", email: "jane@example.com") }
  let(:company_investor) { create(:company_investor, company:, user: investor_user) }
  let(:start_date) { Date.new(2024, 6, 1) }
  let(:end_date) { start_date.end_of_month }
  let(:expected_report_date) { start_date.strftime("%B %Y") }

  let!(:consolidated_invoice) do
    create(:consolidated_invoice,
           company:,
           invoice_date: Date.new(2024, 6, 1),
           invoice_amount_cents: 70000,
           flexile_fee_cents: 4500,
           transfer_fee_cents: 125,
           status: "sent",
           created_at: Date.new(2024, 6, 1),
           invoices: [invoice])
  end

  let!(:invoice) do
    create(:invoice,
           user:,
           cash_amount_in_cents: 30000,
           equity_amount_in_cents: 0,
           total_amount_in_usd_cents: 30000,
           status: Invoice::RECEIVED)
  end

  let!(:dividend_round) do
    create(:dividend_round,
           company:,
           issued_at: Date.new(2024, 6, 4),
           status: "Paid")
  end

  let!(:dividend) do
    create(:dividend,
           company:,
           company_investor:,
           dividend_round:,
           total_amount_in_cents: 25025,
           net_amount_in_cents: 23000,
           number_of_shares: 24,
           withholding_percentage: 5,
           withheld_tax_cents: 200,
           paid_at: Date.new(2024, 6, 2),
           status: "Paid")
  end

  let!(:dividend_payment) do
    create(:dividend_payment,
           dividends: [dividend],
           status: Payment::SUCCEEDED,
           processor_name: "wise",
           transfer_id: "cde456",
           total_transaction_cents: 11900,
           transfer_fee_in_cents: 600,
           created_at: Date.new(2024, 6, 3))
  end

  let(:option_pool) { create(:option_pool, company:) }
  let(:equity_grant) do
    create(:equity_grant,
           company_investor:,
           option_pool:,
           number_of_shares: 1000,
           vested_shares: 100,
           unvested_shares: 900,
           share_price_usd: 10.0,
           exercise_price_usd: 5.0,
           expires_at: Date.new(2025, 6, 1))
  end

  let!(:vesting_event) do
    create(:vesting_event,
           equity_grant:,
           vested_shares: 100,
           vesting_date: Date.new(2024, 6, 15),
           processed_at: Date.new(2024, 6, 16))
  end

  describe "#process" do
    it "returns a hash with all four CSV types with date-based names" do
      service = described_class.new(start_date: start_date, end_date: end_date)
      result = service.process

      expect(result.keys).to match_array([
                                           "invoices-#{expected_report_date}.csv",
                                           "dividends-#{expected_report_date}.csv",
                                           "grouped-#{expected_report_date}.csv",
                                           "stock_options-#{expected_report_date}.csv"
                                         ])
      expect(result["invoices-#{expected_report_date}.csv"]).to be_a(String)
      expect(result["dividends-#{expected_report_date}.csv"]).to be_a(String)
      expect(result["grouped-#{expected_report_date}.csv"]).to be_a(String)
      expect(result["stock_options-#{expected_report_date}.csv"]).to be_a(String)
    end
  end

  describe "invoices CSV generation" do
    it "generates CSV with correct headers and invoice data" do
      service = described_class.new(start_date: start_date, end_date: end_date)
      result = service.process
      csv = result["invoices-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expected_headers = ["Invoice date", "Payment succeeded at", "Consolidated invoice ID", "Client name", "Invoiced amount (USD)",
                          "Flexile fees (USD)", "Transfer fees (USD)", "Total amount (USD)", "Stripe fee (USD)",
                          "Consolidated invoice status", "Stripe payment intent ID", "Contractor name", "Wise account holder name",
                          "Wise recipient ID", "Invoice ID", "Wise transfer ID", "Cash amount (USD)", "Equity amount (USD)",
                          "Total amount (USD)", "Invoice status"]

      expect(rows[0]).to eq(expected_headers)
      expect(rows.length).to eq(3) # header + data + totals

      data_row = rows[1]
      expect(data_row[0]).to eq("6/1/2024") # Invoice date
      expect(data_row[3]).to eq("TestCo") # Client name
      expect(data_row[4]).to eq("700.0") # Invoiced amount
      expect(data_row[11]).to eq("John Contractor") # Contractor name
      expect(data_row[16]).to eq("300.0") # Cash amount
      expect(data_row[19]).to eq("open") # Status (RECEIVED -> open)
    end

    it "includes totals row for invoices" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["invoices-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[4]).to eq("700.0") # Total invoiced amount
      expect(totals_row[16]).to eq("300.0") # Total cash amount
    end
  end

  describe "dividends CSV generation" do
    it "generates CSV with correct headers" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["dividends-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expected_headers = ["Date initiated", "Date paid", "Client name", "Dividend round ID", "Dividend ID",
                          "Investor name", "Investor email", "Number of shares", "Dividend amount (USD)", "Processor",
                          "Transfer ID", "Total transaction amount (USD)", "Net amount (USD)", "Transfer fee (USD)", "Tax withholding percentage",
                          "Tax withheld", "Flexile fee (USD)", "Dividend round status"]

      expect(rows[0]).to eq(expected_headers)
    end

    it "generates CSV with correct dividend data when data exists" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["dividends-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(3) # header + data + totals

      data_row = rows[1]
      expect(data_row[2]).to eq("TestCo")
      expect(data_row[5]).to eq("Jane Investor")
      expect(data_row[6]).to eq("jane@example.com")
      expect(data_row[7]).to eq("24")
      expect(data_row[8]).to eq("250.25")
      expect(data_row[9]).to eq("wise")
    end

    it "includes totals row when dividend data exists" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["dividends-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(3) # header + data + totals

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[7]).to be_present # Total shares
      expect(totals_row[8]).to be_present # Total dividend amount
    end

    it "only shows headers when no dividend data exists" do
      start_date = Date.new(2023, 1, 1)
      end_date = start_date.end_of_month
      report_date = start_date.strftime("%B %Y")

      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["dividends-#{report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(1) # only headers
    end
  end

  describe "grouped CSV generation" do
    it "generates CSV with correct headers" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["grouped-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expected_headers = ["Type", "Date", "Client name", "Description", "Amount (USD)", "Flexile fee (USD)", "Transfer fee (USD)", "Net amount (USD)"]

      expect(rows[0]).to eq(expected_headers)
    end

    it "includes invoice data when invoices exist" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["grouped-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      invoice_rows = rows.select { |row| row[0] == "Invoice" }
      expect(invoice_rows).not_to be_empty

      invoice_row = invoice_rows.first
      expect(invoice_row[1]).to eq("6/1/2024")
      expect(invoice_row[2]).to eq("TestCo")
      expect(invoice_row[3]).to include("Invoice ##{invoice.id} - John Contractor")
      expect(invoice_row[4]).to eq("300.0")
    end

    it "includes dividend data when dividends exist" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["grouped-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      dividend_rows = rows.select { |row| row[0] == "Dividend" }
      expect(dividend_rows).not_to be_empty

      dividend_row = dividend_rows.first
      expect(dividend_row[2]).to eq("TestCo")
      expect(dividend_row[3]).to include("Dividend ##{dividend.id} - Jane Investor")
      expect(dividend_row[4]).to eq("250.25")
    end

    it "includes totals row when grouped data exists" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["grouped-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to be > 1 # headers + data

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[4]).to be_present # total amount
    end

    it "only shows headers when no grouped data exists" do
      start_date = Date.new(2023, 1, 1)
      end_date = start_date.end_of_month
      report_date = start_date.strftime("%B %Y")

      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["grouped-#{report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(1) # only headers
    end
  end

  describe "stock options CSV generation" do
    it "generates CSV with correct headers and stock options data" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["stock_options-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expected_headers = ["Date Vested", "Company Name", "Investor Name", "Investor Email", "Grant ID", "Vesting Event ID",
                          "Shares Vested", "Exercise Price (USD)", "Current Share Price (USD)", "Expiration Date",
                          "Black-Scholes Option Value", "Total Option Expense", "Grant Type", "Grant Status"]

      expect(rows[0]).to eq(expected_headers)
      expect(rows.length).to eq(3)

      data_row = rows[1]
      expect(data_row[0]).to match(/\d{1,2}\/\d{1,2}\/\d{4}/)
      expect(data_row[1]).to eq("TestCo")
      expect(data_row[2]).to eq("Jane Investor")
      expect(data_row[3]).to eq("jane@example.com")
      expect(data_row[6]).to eq("100")
      expect(data_row[7]).to eq("5.0")
      expect(data_row[8]).to eq("10.0")
      expect(data_row[9]).to eq("6/1/2025")
      expect(data_row[13]).to eq("Active")
    end

    it "includes totals row for stock options" do
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["stock_options-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[6]).to eq("100.0")
      expect(totals_row[11]).to be_present
    end

    it "handles empty vesting events gracefully" do
      start_date = Date.new(2023, 1, 1)
      end_date = start_date.end_of_month
      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["stock_options-#{start_date.strftime("%B %Y")}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(1)
    end
  end

  describe "edge cases" do
    it "handles dividends without successful payments" do
      start_date = Date.new(2024, 7, 1)
      end_date = start_date.end_of_month
      report_date = start_date.strftime("%B %Y")

      company = create(:company)
      user = create(:user)
      company_investor = create(:company_investor, company:, user:)
      dividend_round = create(:dividend_round, company:, status: "Paid")

      failed_dividend = create(:dividend,
                               company:,
                               company_investor:,
                               dividend_round:,
                               status: "Paid")
      create(:dividend_payment,
             dividends: [failed_dividend],
             status: Payment::FAILED,
             created_at: start_date + 2.days)

      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["dividends-#{report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(1) # only headers
    end

    it "only includes vested options" do
      non_vested_grant = create(:equity_grant,
                                company_investor:,
                                option_pool:,
                                exercise_price_usd: 95.0,
                                share_price_usd: 100.0,
                                expires_at: Date.new(2025, 6, 1))

      create(:vesting_event,
             equity_grant: non_vested_grant,
             vested_shares: 50,
             vesting_date: Date.new(2024, 6, 20),
             processed_at: nil)

      service = described_class.new(start_date:, end_date:)
      result = service.process
      csv = result["stock_options-#{expected_report_date}.csv"]
      rows = CSV.parse(csv)

      expect(rows.length).to eq(3)
      expect(rows[1][6]).to eq("100")
    end
  end
end
