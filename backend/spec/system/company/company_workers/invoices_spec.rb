# frozen_string_literal: true

RSpec.describe "Invoice listing page" do
  include InvoiceHelpers

  let(:contractor_user) { contractor.user }
  let(:company) { create(:company) }
  let(:admin_user) { create(:company_administrator, company:).user }
  let(:contractor) { create(:company_worker, company:) }

  before do
    Wise::AccountBalance.update_flexile_balance(amount_cents: 1060)

    admin_user_2 = create(:company_administrator, company:).user

    sign_in admin_user

    @open_invoice = create(:invoice, company:, user: contractor_user, invoice_date: Date.parse("3 Jan 2022"))
    @rejected_invoice = create(:invoice, company:, user: contractor_user, status: Invoice::REJECTED, invoice_date: Date.parse("3 Jan 2022"), rejected_at: Date.parse("5 Jan 2022"), rejected_by: admin_user, rejection_reason: "Duplicate invoice")

    @paid_invoice = create(:invoice, company:, user: contractor_user, status: Invoice::PAID, invoice_date: Date.parse("3 Jan 2022"), paid_at: DateTime.new(2022, 1, 4, 23, 59))
    @approved_invoice = create(:invoice, company:, user: contractor_user, status: Invoice::APPROVED, invoice_date: Date.parse("3 Jan 2022"))
    create(:invoice_approval, invoice: @approved_invoice, approver: admin_user_2)

    @failed_invoice = create(:invoice, company:, user: contractor_user, status: Invoice::FAILED, invoice_date: Date.parse("3 Jan 2022"))
    @processing_invoice = create(:invoice, company:, user: contractor_user, status: Invoice::PROCESSING, invoice_date: Date.parse("3 Jan 2022"))
    @payment_pending_invoice = create(:invoice, company:, user: contractor_user, status: Invoice::PAYMENT_PENDING, invoice_date: Date.parse("3 Jan 2022"))
  end

  it "shows details formatted as expected" do
    visit spa_company_worker_path(company.external_id, contractor.external_id, selectedTab: "invoices")

    expect(page).to have_text(contractor_user.name)
    expect(page).to have_button("End contract")

    [
      @open_invoice,
      @rejected_invoice,
      @failed_invoice,
      @approved_invoice,
      @processing_invoice,
      @payment_pending_invoice,
    ].each do |invoice|
      expect(page).to have_selector(:table_row, { "Invoice ID" => invoice.invoice_number, "Paid" => "-", "Hours" => "01:00", "Amount" => "$60" })
    end

    expect(page).to have_selector(:table_row, { "Invoice ID" => @paid_invoice.invoice_number, "Hours" => "01:00" })
    expect(page).to have_selector(:table_row, { "Invoice ID" => @open_invoice.invoice_number, "Status" => human_status(@open_invoice) })
    expect(page).to have_selector(:table_row, { "Invoice ID" => @rejected_invoice.invoice_number })
    within(:table_row, { "Invoice ID" => @rejected_invoice.invoice_number }) do
      expect(find_button(human_status(@rejected_invoice))).to have_tooltip "Rejected by you"
    end
    expect(page).to have_selector(:table_row, { "Invoice ID" => @failed_invoice.invoice_number, "Status" => human_status(@failed_invoice) })
    expect(page).to have_selector(:table_row, { "Invoice ID" => @approved_invoice.invoice_number, "Status" => human_status(@approved_invoice) })
    expect(page).to have_selector(:table_row, { "Invoice ID" => @processing_invoice.invoice_number, "Status" => human_status(@processing_invoice) })
    expect(page).to have_selector(:table_row, { "Invoice ID" => @payment_pending_invoice.invoice_number, "Status" => human_status(@payment_pending_invoice) })

    # Invoice link
    find(:table_row, { "Invoice ID" => @paid_invoice.invoice_number }).click
    expect(page).to have_current_path(spa_company_invoice_path(company.external_id, @paid_invoice.external_id))
    expect(page).to have_text("Invoice #{@paid_invoice.invoice_number}")
  end

  describe "pagination" do
    it "paginates records" do
      stub_const("Internal::Companies::WorkersController::RECORDS_PER_PAGE", 1)

      visit spa_company_worker_path(company.external_id, contractor.external_id, selectedTab: "invoices")

      expect(page).to have_selector("[aria-label='Pagination']", count: 1)
    end

    it "doesn't show the pagination element if there is only one page" do
      visit spa_company_worker_path(company.external_id, contractor.external_id, selectedTab: "invoices")

      expect(page).to have_selector("[aria-label='Pagination']", count: 0)
    end
  end
end
