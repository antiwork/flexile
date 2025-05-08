# frozen_string_literal: true

RSpec.describe "Company Billing" do
  include InvoiceHelpers

  let(:company) { create(:company) }
  let(:administrator) { create(:company_administrator, company:).user }
  let(:total_contractors) { [1, 2] }
  let(:invoices_data) do
    [
      { status: "sent", date: 1.month.ago, total_cents: 40_000_00, number_of_contractors: 4 },
      { status: "failed", date: 2.months.ago, total_cents: 30_000_00, number_of_contractors: 3 },
      { status: "paid", date: 3.months.ago, total_cents: 20_000_00, number_of_contractors: 2 },
      { status: "processing", date: 4.months.ago, total_cents: 10_000_00, number_of_contractors: 1 },
      { status: "refunded", date: 5.months.ago, total_cents: 5_000_00, number_of_contractors: 1 }
    ]
  end
  let!(:consolidated_invoices) do
    invoices_data.map do |data|
      create(:consolidated_invoice, company:, invoice_date: data[:date],
                                    status: data[:status], total_cents: data[:total_cents],
                                    invoices: create_list(:invoice, data[:number_of_contractors]))
    end
  end

  before { sign_in administrator }

  it "shows the company details" do
    visit spa_company_administrator_settings_billing_path(company.external_id)

    expect(page).to have_selector("h1", text: "Company account")
    expect(page).to have_link("Settings", href: spa_company_administrator_settings_path(company.external_id))

    consolidated_invoices.each do |consolidated_invoice|
      expect(page).to have_selector(:table_row,
                                    {
                                      "Date" => consolidated_invoice[:invoice_date].strftime("%b %-d, %Y"),
                                      "Contractors" => consolidated_invoice.total_contractors,
                                      "Invoice total" => consolidated_invoice.total_amount_in_usd.to_fs(:currency, strip_insignificant_zeros: true),
                                      "Status" => human_status(consolidated_invoice),
                                    })
    end
  end

  it "shows the download button for a consolidated invoice with receipt" do
    consolidated_invoice_with_receipt = create(:consolidated_invoice, :paid, company:)
    consolidated_invoices << consolidated_invoice_with_receipt
    visit spa_company_administrator_settings_billing_path(company.external_id)

    expect(page).to have_link("Download", href: rails_blob_path(consolidated_invoice_with_receipt.receipt, disposition: "attachment"), count: 1)
  end
end
