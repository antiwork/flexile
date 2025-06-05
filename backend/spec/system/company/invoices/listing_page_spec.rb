# frozen_string_literal: true

require "shared_examples/internal/stripe_microdeposit_verification_examples"

RSpec.describe "Invoice listing page" do
  include InvoiceHelpers

  let(:contractor_user) { create(:user) }
  let(:admin_user) { create(:user) }
  let(:company) { create(:company, required_invoice_approval_count: 2) }
  let!(:company_worker) { create(:company_worker, company:, user: contractor_user) }
  let!(:administrator) { create(:company_administrator, company:, user: admin_user) }

  def invoice_action_path(invoice)
    Invoice::EDITABLE_STATES.include?(invoice.status) ?
      edit_spa_company_invoice_path(invoice.company.external_id, invoice.external_id) :
      spa_company_invoice_path(invoice.company.external_id, invoice.external_id)
  end

  shared_examples "auto resolve current company ID" do
    it "redirects to the correct company" do
      visit spa_company_invoices_path("_")
      expect(page).to have_current_path(spa_company_invoices_path(company.external_id))
    end
  end

  context "when logged in as a company worker" do
    before do
      sign_in contractor_user
      create_list(:invoice, 2, company:, user: contractor_user)
      create_list(:invoice, 2, company:, user: contractor_user, status: Invoice::FAILED)
      create_list(:invoice, 2, company:, user: contractor_user, status: Invoice::PROCESSING)
      create(:invoice, company:, user: contractor_user, status: Invoice::PAYMENT_PENDING)

      another_contractor = create(:company_worker, company:)
      create_list(:invoice, 2, company:, user: another_contractor.user)
    end

    include_examples "auto resolve current company ID"

    it "shows details formatted as expected" do
      Invoice.destroy_all
      invoice = create(:invoice, company:, user: contractor_user,
                                 invoice_date: Date.parse("3 Jan 2022"),
                                 created_at: Date.parse("3 Jan 2022"))
      paid_invoice = create(:invoice, company:, user: contractor_user,
                                      status: Invoice::PAID,
                                      rejection_reason: "some reason that was subsequently addressed",
                                      paid_at: Date.parse("4 Feb 2022"),
                                      invoice_date: Date.parse("3 Jan 2022"))
      rejected_invoice = create(:invoice, company:, user: contractor_user,
                                          status: Invoice::REJECTED,
                                          rejected_by: admin_user,
                                          rejected_at: Date.parse("4 Jan 2022"),
                                          rejection_reason: "some reason",
                                          invoice_date: Date.parse("3 Jan 2022"))
      rejected_invoice_nil_admin = create(:invoice, company:, user: contractor_user,
                                                    status: Invoice::REJECTED,
                                                    rejected_by: nil,
                                                    rejection_reason: "some other reason",
                                                    invoice_date: Date.parse("3 Jan 2022"))
      processing_invoice = create(:invoice, :processing, company:, user: contractor_user, invoice_date: Date.parse("5 Jan 2022"))
      payment_pending_invoice = create(:invoice, :payment_pending, company:, user: contractor_user, invoice_date: Date.parse("7 Jan 2022"))

      visit spa_company_invoices_path(company.external_id)

      within(:table_row, { "Invoice ID" => invoice.invoice_number, "Sent on" => "Jan 3, 2022", "Hours" => "01:00", "Amount" => "$60", "Status" => human_status(invoice) }) do
        expect(page).to have_link(href: invoice_action_path(invoice))
      end

      within(:table_row, { "Invoice ID" => paid_invoice.invoice_number, "Sent on" => "Jan 3, 2022", "Hours" => "01:00", "Amount" => "$60", "Status" => human_status(paid_invoice) }) do
        expect(page).to have_link(href: invoice_action_path(paid_invoice))
        expect(page).to_not have_button(human_status(paid_invoice))
      end

      within(:table_row, { "Invoice ID" => rejected_invoice.invoice_number, "Sent on" => "Jan 3, 2022" }) do
        expect(page).to have_link(href: invoice_action_path(rejected_invoice))
        expect(find_button(human_status(rejected_invoice))).to have_tooltip "Rejected by #{admin_user.name} on Jan 4, 2022: \"some reason\""
      end

      within(:table_row, { "Invoice ID" => rejected_invoice_nil_admin.invoice_number, "Sent on" => "Jan 3, 2022" }) do
        expect(page).to have_link(href: invoice_action_path(rejected_invoice_nil_admin))
        expect(find_button(human_status(rejected_invoice_nil_admin))).to have_tooltip "Rejected: \"some other reason\""
      end

      within(:table_row, { "Invoice ID" => processing_invoice.invoice_number, "Sent on" => "Jan 5, 2022" }) do
        expect(page).to have_link(href: invoice_action_path(processing_invoice))
        expect(find_button(human_status(processing_invoice))).to have_tooltip "Your payment should arrive by #{processing_invoice.payment_expected_by.strftime("%b %-d, %Y")}"
      end

      within(:table_row, { "Invoice ID" => payment_pending_invoice.invoice_number, "Sent on" => "Jan 7, 2022" }) do
        expect(page).to have_link(href: invoice_action_path(payment_pending_invoice))
        expect(find_button(human_status(payment_pending_invoice))).to have_tooltip "Your payment should arrive by #{payment_pending_invoice.payment_expected_by.strftime("%b %-d, %Y")}"
      end
    end

    it "shows all invoices" do
      create(:invoice, :approved, company:, user: contractor_user) # payable invoice
      visit spa_company_invoices_path(company.external_id)

      invoices = contractor_user.invoices
      invoices.each do |invoice|
        within(:table_row, { "Invoice ID" => invoice.invoice_number, "Status" => human_status(invoice) }) do
          expect(page).to have_link(href: invoice_action_path(invoice))
        end
      end
      expect(page).to have_selector("tbody tr", count: invoices.count)
    end

    describe "pagination" do
      let!(:invoice) { create(:invoice, company:, user: contractor_user, invoice_date: 1.day.from_now) }
      let!(:failed_invoice) { create(:invoice, company:, user: contractor_user, status: Invoice::FAILED, invoice_date: 2.days.from_now) }
      let!(:processing_invoice) { create(:invoice, company:, user: contractor_user, status: Invoice::PROCESSING, invoice_date: 3.days.from_now) }

      it "paginates records" do
        stub_const("InvoicesPresenter::RECORDS_PER_PAGE", 2)

        visit spa_company_invoices_path(company.external_id)
        expect(page).to have_table(with_rows: [{ "Invoice ID" => processing_invoice.invoice_number }, { "Invoice ID" => failed_invoice.invoice_number }])

        within "[aria-label='Pagination']" do
          click_on "2"
        end
        expect(page).to have_table(with_rows: [{ "Invoice ID" => invoice.invoice_number }])
      end

      it "doesn't show the pagination element if there is only one page" do
        visit spa_company_invoices_path(company.external_id)

        expect(page).to have_selector("h1", text: "Invoicing")
        expect(page).to_not have_selector("[aria-label='Pagination']")
      end
    end

    context "when contractor is an alumni" do
      before do
        company_worker.update!(ended_at: 1.day.ago)
      end

      it "can view but not submit invoices" do
        invoice1 = create(:invoice, :approved, company:, user: contractor_user)
        invoice2 = create(:invoice, company:, user: contractor_user,
                                    paid_at: Date.parse("4 Feb 2022"),
                                    invoice_date: Date.parse("3 Jan 2022"))

        visit spa_company_invoices_path(company.external_id)

        expect(page).to_not have_link("New invoice")
        expect(page).to_not have_text("Quick invoice")
        expect(page).to_not have_field("Hours worked")
        expect(page).to_not have_field("Invoice date")

        expect(page).to have_table(with_rows: [
                                     { "Invoice ID" => invoice1.invoice_number },
                                     { "Invoice ID" => invoice2.invoice_number }
                                   ])
      end
    end

    context "when the user is also administrator to another company" do
      let!(:company_administrator) { create(:company_administrator, user: contractor_user) }
      let(:another_company) { company_administrator.company }

      it "can view invoices for both companies" do
        visit spa_company_invoices_path(company.external_id)
        expect(page).to have_selector("h1", text: "Invoicing")

        select_disclosure another_company.display_name do
          click_on "Invoices"
          wait_for_ajax
        end
        expect(page).to have_selector("h1", text: "Invoicing")
      end
    end
  end

  context "when logged in as a company admin" do
    before do
      sign_in admin_user

      another_company = create(:company)
      another_contractor = create(:company_worker, company: another_company)
      create_list(:invoice, 2, company: another_company, user: another_contractor.user)
    end

    # Approvable invoices
    let!(:received_invoices) do
      [
        create(:invoice, company:, invoice_date: Date.parse("Dec 1, 2023")),
        create(:invoice, company:, invoice_date: Date.parse("Nov 1, 2023")),
        create(:invoice, :project_based, company_worker: create(:company_worker, :project_based, company:), invoice_date: Date.parse("Nov 1, 2023")),
      ]
    end
    let!(:partially_approved_invoices) do
      [
        create(:invoice, :partially_approved, company:, invoice_date: Date.parse("Oct 1, 2023")),
        create(:invoice, :partially_approved, company:, invoice_date: Date.parse("Sept 1, 2023")),
      ]
    end
    let!(:fully_approved_invoices) { create_list(:invoice, 2, :fully_approved, company:) }
    let!(:failed_invoices) { create_list(:invoice, 2, :fully_approved, company:, user: contractor_user, status: Invoice::FAILED) { _1.update!(invoice_date: _2.days.ago) } }
    let(:approvable_invoices) { received_invoices + partially_approved_invoices + fully_approved_invoices + failed_invoices }

    # Approved invoices
    let!(:approved_by_admin) do
      invoices = create_list(:invoice, 2, company:, status: Invoice::APPROVED)
      invoices.map { create(:invoice_approval, approver: admin_user, invoice: _1) }
      invoices
    end
    let!(:processing_invoices) { create_list(:invoice, 2, :processing, company:) }
    let!(:payment_pending_invoices) { create_list(:invoice, 2, :payment_pending, company:) }
    let(:approved_invoices) { approved_by_admin + processing_invoices + payment_pending_invoices }

    # Rejected invoices
    let(:other_admin) { create(:company_administrator, company:, user: create(:user, legal_name: "Jane Admin")).user }
    let!(:rejected_invoices) do
      [
        create(:invoice, company:, user: contractor_user, status: Invoice::REJECTED, rejected_at: Date.new(2024, 2, 1), rejected_by: admin_user, total_amount_in_usd_cents: 45_00, rejection_reason: "Incorrect amount", invoice_date: 3.days.ago),
        create(:invoice, company:, user: contractor_user, status: Invoice::REJECTED, rejected_at: Date.new(2023, 12, 18), rejected_by: other_admin, total_amount_in_usd_cents: 55_00, rejection_reason: "Duplicate invoice", invoice_date: 4.days.ago),
      ]
    end

    # Closed (historical) invoices
    let(:paid_invoice_1) { create(:invoice, company:, user: contractor_user, status: Invoice::PAID, invoice_date: Date.new(2022, 11, 15), paid_at: Date.new(2022, 11, 25), total_amount_in_usd_cents: 99_99, rejection_reason: "some reason that was subsequently addressed") }
    let(:paid_invoice_2) { create(:invoice, company:, user: contractor_user, status: Invoice::PAID, invoice_date: Date.new(2022, 11, 15), paid_at: Date.new(2022, 11, 25)) }
    let!(:paid_invoices) { [paid_invoice_1, paid_invoice_2] }
    let(:closed_invoices) { processing_invoices + paid_invoices + payment_pending_invoices }

    include_examples "auto resolve current company ID"

    it "shows invoices that need to be approved by default" do
      visit spa_company_invoices_path(company.external_id)

      # Shows only approvable invoices
      expect(page).to have_selector("tbody tr", count: approvable_invoices.count)
      expect(page).to have_table(with_rows: approvable_invoices.map do |invoice|
        {
          "Contractor" => invoice.bill_from,
          "Sent on" => invoice.invoice_date.strftime("%b %-d, %Y"),
          "Hours" => invoice.company_worker.hourly? ? "01:00" : "N/A",
          "Amount" => "$60",
        }
      end)

      # Shows invoice stats
      expect(page).to have_text("#{approvable_invoices.count} Action required", normalize_ws: true)
      expect(page).to have_text("#{approved_invoices.count} Approved", normalize_ws: true)
      expect(page).to have_text("#{rejected_invoices.count} Rejected", normalize_ws: true)

      # Does not show bottom sheet if no invoices selected
      expect(page).not_to have_button("Deselect all")
    end

    it "shows invoices that are fully approved or have already been approved by the admin" do
      visit spa_company_invoices_path(company.external_id)
      select_tab "Approved"

      # Shows only approved invoices
      expect(page).to have_selector("tbody tr", count: approved_invoices.count)
      expect(page).to have_table(with_rows: approved_invoices.map do |invoice|
        { "Contractor" => invoice.bill_from, "Sent on" => invoice.invoice_date.strftime("%b %-d, %Y"), "Hours" => "01:00", "Amount" => "$60", "Status" => human_status(invoice) }
      end)

      # Shows invoice stats
      expect(page).to have_text("#{approvable_invoices.count} Action required", normalize_ws: true)
      expect(page).to have_text("#{approved_invoices.count} Approved", normalize_ws: true)
      expect(page).to have_text("#{rejected_invoices.count} Rejected", normalize_ws: true)

      # Does not show bottom sheet if no invoices selected
      expect(page).not_to have_button("Deselect all")
    end

    it "shows rejected invoices" do
      visit spa_company_invoices_path(company.external_id)
      select_tab "Rejected"

      # Shows only rejected and failed invoices
      expect(page).to have_selector("tbody tr", count: rejected_invoices.count)
      rejected_invoices.each do |invoice|
        within(:table_row,  { "Contractor" => invoice.bill_from, "Sent on" => invoice.invoice_date.strftime("%b %-d, %Y"), "Hours" => "01:00", "Amount" => "$#{invoice.total_amount_in_usd_cents / 100}" }) do
          expect(page).to have_text human_status(invoice)
        end
      end

      within(:table_row, { "Amount" => "$45" }) do
        expect(find_button(human_status(rejected_invoices.first))).to have_tooltip "Rejected by you on Feb 1, 2024: \"Incorrect amount\""
      end

      within(:table_row, { "Amount" => "$55" }) do
        expect(find_button(human_status(rejected_invoices.last))).to have_tooltip "Rejected by #{other_admin.name} on Dec 18, 2023: \"Duplicate invoice\""
      end

      # Shows invoice stats
      expect(page).to have_text("#{approvable_invoices.count} Action required", normalize_ws: true)
      expect(page).to have_text("#{approved_invoices.count} Approved", normalize_ws: true)
      expect(page).to have_text("#{rejected_invoices.count} Rejected", normalize_ws: true)

      # Does not show bottom sheet
      expect(page).not_to have_button("Deselect all")

      visit spa_company_invoice_path(company.external_id, rejected_invoices[0].external_id)
      expect(page).to have_selector("[role='status']", exact_text: "Rejected by you on Feb 1, 2024: \"Incorrect amount\"")
    end

    it "shows 'closed' invoices when param `history` is set" do
      visit spa_company_invoices_path(company.external_id, tab: "history")

      closed_invoices.each do |invoice|
        expect(page).to have_text(invoice.bill_from)
        expect(page).to have_link(href: spa_company_invoice_path(company.external_id, invoice.external_id))
        expect(page).not_to have_field("Select #{invoice.invoice_number}")
      end

      (processing_invoices + payment_pending_invoices).each do |invoice|
        within(:table_row, { "Contractor" => invoice.bill_from }) do
          expect(find_button(human_status(invoice))).to have_tooltip("Your payment should arrive by #{invoice.payment_expected_by.strftime("%b %-d, %Y")}")
        end
      end

      within(:table_row, { "Amount" => "$99.99" }) do
        expect(page).not_to have_button
      end

      expect(page).to have_text("Payment in progress", count: processing_invoices.size)
      expect(page).to have_text("Paid on Nov 25", count: paid_invoices.size)
      expect(page).to have_text("Payment scheduled", count: payment_pending_invoices.size)
    end

    it "allows selecting all actionable invoices" do
      visit spa_company_invoices_path(company.external_id)

      check "Select all"
      expect(page).to have_text "9 selected"

      expect(page).to have_checked_field("Select row", count: 9)

      select_tab "Approved"
      wait_for_ajax
      expect(page).to_not have_field "Select all"
      expect(page).to_not have_field "Select row"

      select_tab "Rejected"
      wait_for_ajax
      expect(page).to_not have_field "Select all"
      expect(page).to_not have_field "Select row"
    end

    context "when a contractor has not provided tax information" do
      let(:user_without_tax_info) { create(:user, :without_compliance_info) }
      let(:company_worker_without_tax_info) { create(:company_worker, company:, user: user_without_tax_info) }
      let!(:payable_invoice) do
        create(:invoice, :partially_approved, company:, user: user_without_tax_info, company_worker: company_worker_without_tax_info)
      end
      let!(:approvable_invoice) do
        create(:invoice, company:, user: user_without_tax_info, company_worker: company_worker_without_tax_info)
      end

      before do
      end

      it "does not allow invoices to be paid" do
        visit spa_company_invoices_path(company.external_id)

        expect(page).to have_text("Missing tax information")

        within(:table_row, { "Contractor" => user_without_tax_info.legal_name, "Status" => human_status(payable_invoice)  }) do
          expect(page).to have_button("Pay now", disabled: true)
        end

        within(:table_row, { "Contractor" => user_without_tax_info.legal_name, "Status" => human_status(approvable_invoice)  }) do
          expect(page).to have_button("Approve", disabled: false)
        end
      end
    end

    describe "switching invoice filter and pagination" do
      it "clears other filters appropriately" do
        stub_const("InvoicesPresenter::RECORDS_PER_PAGE", 2)

        visit spa_company_invoices_path(company.external_id, tab: "history", page: 2)
        expect(page.current_url).to match_path_and_query_params(spa_company_invoices_path(company.external_id, tab: "history", page: 2))

        select_tab "Open"
        expect(page.current_url).to match_path_and_query_params(spa_company_invoices_path(company.external_id))
        within "[aria-label='Pagination']" do
          click_on "2"
        end
        expect(page.current_url).to match_path_and_query_params(spa_company_invoices_path(company.external_id, page: 2))

        select_tab "Approved"
        expect(page.current_url).to match_path_and_query_params(spa_company_invoices_path(company.external_id, filter: "paying_or_approved"))
        within "[aria-label='Pagination']" do
          click_on "2"
        end
        expect(page.current_url).to match_path_and_query_params(spa_company_invoices_path(company.external_id, filter: "paying_or_approved", page: 2))

        select_tab "Rejected"
        expect(page.current_url).to match_path_and_query_params(spa_company_invoices_path(company.external_id, filter: "rejected"))
      end
    end

    it "allows downloading an invoices CSV from the history view" do
      visit spa_company_invoices_path(company.external_id, tab: "history")

      expect(page).to have_link "Download CSV", href: export_company_invoices_path(company.external_id)
    end

    describe "pagination" do
      it "paginates records" do
        stub_const("InvoicesPresenter::RECORDS_PER_PAGE", 2)

        visit spa_company_invoices_path(company.external_id)
        expect(page).to have_selector("tbody tr", count: 2)

        expect(page).to have_selector("[aria-label='Pagination']", count: 1)
        within "[aria-label='Pagination']" do
          click_on "2"
          expect(page).to have_link "5"
          expect(page).to_not have_link "6"
        end
      end

      it "doesn't show the pagination element if there is only one page" do
        visit spa_company_invoices_path(company.external_id)

        expect(page).to have_selector("[aria-label='Pagination']", count: 0)
      end
    end

    describe "microdeposit verification" do
      let(:arrival_date) { "May 13, 2024" } # see VCR cassette for date

      include_examples "verifying Stripe microdeposits" do
        let(:path) { spa_company_invoices_path(company.external_id) }
      end
    end
  end
end
