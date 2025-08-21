# frozen_string_literal: true

RSpec.describe FinancialReportCsvService do
  let(:company) { create(:company, name: "TestCo") }
  let(:user) { create(:user, legal_name: "John Contractor", email: "john@example.com") }
  let(:investor_user) { create(:user, legal_name: "Jane Investor", email: "jane@example.com") }
  let(:company_investor) { create(:company_investor, company: company, user: investor_user) }

  let(:consolidated_invoice) do
    create(:consolidated_invoice,
           company: company,
           invoice_date: Date.new(2024, 6, 1),
           invoice_amount_cents: 70000,
           flexile_fee_cents: 4500,
           transfer_fee_cents: 125,
           status: "sent",
           created_at: 1.week.ago)
  end

  let(:invoice) do
    create(:invoice,
           user: user,
           consolidated_invoice: consolidated_invoice,
           cash_amount_in_cents: 30000,
           equity_amount_in_cents: 0,
           total_amount_in_usd_cents: 30000,
           status: Invoice::RECEIVED)
  end

  let(:dividend_round) do
    create(:dividend_round,
           company: company,
           issued_at: Date.new(2024, 6, 1),
           status: "completed")
  end

  let(:dividend) do
    create(:dividend,
           company: company,
           company_investor: company_investor,
           dividend_round: dividend_round,
           total_amount_in_cents: 25025,
           net_amount_in_cents: 23000,
           number_of_shares: 24,
           withholding_percentage: 5,
           withheld_tax_cents: 200,
           paid_at: Date.new(2024, 6, 2))
  end

  let(:dividend_payment) do
    create(:dividend_payment,
           dividends: [dividend],
           status: Payment::SUCCEEDED,
           processor_name: "wise",
           transfer_id: "cde456",
           total_transaction_cents: 11900,
           transfer_fee_in_cents: 600,
           created_at: 1.week.ago)
  end

  let(:consolidated_invoices) { [consolidated_invoice] }
  let(:dividends) { [dividend] }
  let(:dividend_rounds) { [dividend_round] }

  before do
    invoice
    dividend_payment
  end

  describe "#generate_all" do
    it "returns a hash with all three CSV types" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      result = service.generate_all

      expect(result.keys).to match_array(["invoices.csv", "dividends.csv", "grouped.csv"])
      expect(result["invoices.csv"]).to be_a(String)
      expect(result["dividends.csv"]).to be_a(String)
      expect(result["grouped.csv"]).to be_a(String)
    end
  end

  describe "invoices CSV generation" do
    it "generates CSV with correct headers and invoice data" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      csv = service.send(:generate_invoices_csv)
      rows = CSV.parse(csv)

      expected_headers = ["Date initiated", "Date succeeded", "Consolidated invoice ID", "Client name", "Invoiced amount", "Flexile fees", "Transfer fees", "Total amount", "Stripe fee",
                          "Consolidated invoice status", "Stripe payment intent ID", "Contractor name", "Wise account holder name", "Wise recipient ID", "Invoice ID", "Wise transfer ID",
                          "Cash amount (USD)", "Equity amount (USD)", "Total amount (USD)", "Status", "Flexile fee cents"]

      expect(rows[0]).to eq(expected_headers)
      expect(rows.length).to eq(3) # header + data + totals

      data_row = rows[1]
      expect(data_row[0]).to eq("6/1/2024") # Date initiated
      expect(data_row[3]).to eq("TestCo") # Client name
      expect(data_row[4]).to eq("700.0") # Invoiced amount
      expect(data_row[11]).to eq("John Contractor") # Contractor name
      expect(data_row[16]).to eq("300.0") # Cash amount
      expect(data_row[19]).to eq("open") # Status (RECEIVED -> open)
      expect(data_row[20]).to eq("4500") # Flexile fee cents
    end

    it "includes totals row for invoices" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      csv = service.send(:generate_invoices_csv)
      rows = CSV.parse(csv)

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[4]).to eq("700.0") # Total invoiced amount
      expect(totals_row[16]).to eq("300.0") # Total cash amount
      expect(totals_row[20]).to eq("4500") # Total flexile fee cents
    end
  end

  describe "dividends CSV generation" do
    it "generates CSV with correct headers and dividend data" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      csv = service.send(:generate_dividends_csv)
      rows = CSV.parse(csv)

      expected_headers = ["Type", "Date initiated", "Date paid", "Client name", "Dividend round ID", "Dividend ID",
                          "Investor name", "Investor email", "Number of shares", "Dividend amount", "Processor",
                          "Transfer ID", "Total transaction amount", "Net amount", "Transfer fee", "Tax withholding percentage",
                          "Tax withheld", "Flexile fee cents", "Round status", "Total investors in round"]

      expect(rows[0]).to eq(expected_headers)
      expect(rows.length).to eq(4) # header + individual payment + round summary + totals

      # Individual payment row
      individual_row = rows[1]
      expect(individual_row[0]).to eq("Individual Payment")
      expect(individual_row[3]).to eq("TestCo")
      expect(individual_row[6]).to eq("Jane Investor")
      expect(individual_row[7]).to eq("jane@example.com")
      expect(individual_row[8]).to eq("24")
      expect(individual_row[9]).to eq("250.25")
      expect(individual_row[10]).to eq("wise")

      # Round summary row
      round_row = rows[2]
      expect(round_row[0]).to eq("Round Summary")
      expect(round_row[3]).to eq("TestCo")
      expect(round_row[18]).to eq("completed")
      expect(round_row[19]).to eq("1")
    end

    it "includes totals row for dividends" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      csv = service.send(:generate_dividends_csv)
      rows = CSV.parse(csv)

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[8]).to eq("24.0") # Total shares
      expect(totals_row[9]).to eq("500.5") # Total dividend amount (individual + round)
    end
  end

  describe "grouped CSV generation" do
    it "generates CSV with correct headers and grouped data" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      csv = service.send(:generate_grouped_csv)
      rows = CSV.parse(csv)

      expected_headers = ["Type", "Date", "Client name", "Description", "Amount (USD)", "Flexile fee cents", "Transfer fee (USD)", "Net amount (USD)"]

      expect(rows[0]).to eq(expected_headers)
      expect(rows.length).to eq(4) # header + invoice + dividend + totals

      # Invoice row
      invoice_row = rows[1]
      expect(invoice_row[0]).to eq("Invoice")
      expect(invoice_row[1]).to eq("6/1/2024")
      expect(invoice_row[2]).to eq("TestCo")
      expect(invoice_row[3]).to include("Invoice ##{invoice.id} - John Contractor")
      expect(invoice_row[4]).to eq("300.0")

      # Dividend row
      dividend_row = rows[2]
      expect(dividend_row[0]).to eq("Dividend")
      expect(dividend_row[2]).to eq("TestCo")
      expect(dividend_row[3]).to include("Dividend ##{dividend.id} - Jane Investor")
      expect(dividend_row[4]).to eq("250.25")
    end

    it "includes totals row for grouped data" do
      service = described_class.new(consolidated_invoices, dividends, dividend_rounds)
      csv = service.send(:generate_grouped_csv)
      rows = CSV.parse(csv)

      totals_row = rows.last
      expect(totals_row[0]).to eq("TOTAL")
      expect(totals_row[4]).to eq("550.25") # Total amount (invoice + dividend)
    end
  end

  describe "edge cases" do
    it "handles empty data gracefully" do
      service = described_class.new([], [], [])
      result = service.generate_all

      invoices_csv = CSV.parse(result["invoices.csv"])
      dividends_csv = CSV.parse(result["dividends.csv"])
      grouped_csv = CSV.parse(result["grouped.csv"])

      # Should only have headers, no data or totals rows
      expect(invoices_csv.length).to eq(1)
      expect(dividends_csv.length).to eq(1)
      expect(grouped_csv.length).to eq(1)
    end

    it "handles dividends without successful payments" do
      failed_dividend = create(:dividend,
                               company: company,
                               company_investor: company_investor,
                               dividend_round: dividend_round)
      create(:dividend_payment,
             dividends: [failed_dividend],
             status: Payment::FAILED)

      service = described_class.new([], [failed_dividend], [])
      csv = service.send(:generate_dividends_csv)
      rows = CSV.parse(csv)

      # Should only have headers, no data rows since payment failed
      expect(rows.length).to eq(1)
    end
  end
end
