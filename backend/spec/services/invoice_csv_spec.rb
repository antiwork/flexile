# frozen_string_literal: true

RSpec.describe InvoiceCsv do
  let(:company) { create(:company) }
  let(:company_worker1) { create(:company_worker, company:) }
  let(:company_worker2) { create(:company_worker, company:) }

  it "generates a CSV export of analytics data" do
    invoices = []
    invoices << create(:invoice, company:, user: company_worker1.user, invoice_date: Date.new(2022, 1, 1), total_amount_in_usd_cents: 1729, invoice_number: "invoice-1", status: Invoice::PAID)
    invoices << create(:invoice, company:, user: company_worker1.user, invoice_date: Date.new(2022, 1, 31), total_amount_in_usd_cents: 141, invoice_number: "invoice-2", status: Invoice::APPROVED)
    invoices << create(:invoice, company:, user: company_worker2.user, invoice_date: Date.new(2022, 1, 24), total_amount_in_usd_cents: 272, invoice_number: "invoice-3")
    invoices << create(:invoice, company:, user: company_worker2.user, invoice_date: Date.new(2022, 2, 1), total_amount_in_usd_cents: 314, invoice_number: "invoice-4", status: Invoice::REJECTED)

    expected_csv = <<~CSV
      Contractor name,Role,Invoice date,Invoice ID,Paid at,Amount in USD,Status
      #{company_worker1.user.legal_name},#{company_worker1.role},1/1/2022,invoice-1,,17.29,paid
      #{company_worker1.user.legal_name},#{company_worker1.role},1/31/2022,invoice-2,,1.41,approved
      #{company_worker2.user.legal_name},#{company_worker2.role},1/24/2022,invoice-3,,2.72,open
      #{company_worker2.user.legal_name},#{company_worker2.role},2/1/2022,invoice-4,,3.14,rejected
    CSV

    expect(described_class.new(invoices).generate).to eq(expected_csv)
  end
end
