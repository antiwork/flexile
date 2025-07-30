# frozen_string_literal: true

RSpec.describe "Invoice update flow" do
  let(:date) { "2022-01-03" }
  let(:user) { create(:user, zip_code: "22222", street_address: "1st St.") }
  let(:company) do
    company = create(:company)
    company.update!(equity_enabled: true)
    company
  end
  let!(:expense_category) { create(:expense_category, company:) }
  let(:year) { Date.current.year }

  def humanized_duration(invoice)
    hours, minutes = invoice.total_minutes.divmod(60)
    format("%02d:%02d", hours, minutes)
  end

  shared_examples "common invoice re-submission specs" do |rate_type:, expected_minutes:|
    it "allows re-submitting an invoice" do
      if invoice.status == Invoice::REJECTED
        expect(page).to have_text("Action required")
      elsif invoice.status == Invoice::RECEIVED
        expect(page).to have_link("Cancel", href: spa_company_invoices_path(company.external_id))
      end

      expect(page).to have_field("Invoice ID", with: "INV-1")
      expect(page).to have_field("Date", with: date)
      expect(page).to have_field("Description", with: invoice.invoice_line_items.last.description)

      if rate_type == :hourly
        expect(page).to have_field("Hours", with: humanized_duration(invoice))
        fill_in "Hours", with: "03:25"
      elsif rate_type == :project_based
        expect(page).to have_field("Amount", with: "#{invoice.invoice_line_items.last.total_amount_cents / 100}")
        fill_in "Amount", with: "205"
      end
      fill_in "Date", with: "08/08/2025"
      fill_in "Description", with: "I worked on invoices"

      expect(page).to have_text("Total $205", normalize_ws: true)

      click_on "Add line item"
      within all("tbody tr")[1] do
        if rate_type == :hourly
          fill_in "Hours", with: "10:00"
        elsif rate_type == :project_based
          fill_in "Amount", with: "600"
        end
        fill_in "Description", with: "I worked on other stuff"
      end
      expect(page).to have_text("Total $805", normalize_ws: true)
      within all("tbody tr")[1] do
        click_on "Remove"
      end

      click_on "Re-submit"
      wait_for_ajax
      expect(page).to_not have_text("Rejected")
      expect(page).to have_text("Awaiting approval (0/2)")

      invoice = Invoice.alive.last
      invoice_line_item = invoice.invoice_line_items.last
      expect(invoice.invoice_number).to eq("INV-1")
      expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq("2025-08-08")
      expect(invoice.total_minutes).to eq(expected_minutes)
      expect(invoice_line_item.description).to eq("I worked on invoices")
      expect(invoice_line_item.minutes).to eq(expected_minutes)
      expect(invoice_line_item.pay_rate_usd).to eq(contractor.pay_rate_usd)
      expect(invoice_line_item.total_amount_cents).to eq(205_00)
      expect(invoice.total_amount_in_usd_cents).to eq(205_00)
      expect(invoice.cash_amount_in_cents).to eq(205_00)
      expect(invoice.equity_amount_in_cents).to eq(0)
    end

    it "allows updating the invoice's existing expenses when expenses flag is disabled" do
      invoice_expense = create(:invoice_expense, invoice:, expense_category:)

      expect(page).to have_field("Invoice ID", with: "INV-1")
      expect(page).to have_field("Date", with: date)
      expect(page).to have_field("Description", with: invoice.invoice_line_items.last.description)
      expect(page).to have_text("Total expenses $1,000", normalize_ws: true)

      within find(:table_row, { "Expense" => "expense.pdf" }) do
        expect(page).to have_select("Category", selected: "Travel")
        expect(page).to have_field("Merchant", with: "American Airlines")
        expect(page).to have_field("Amount", with: 1_000)
        fill_in "Merchant", with: "British Airways"
        fill_in "Amount", with: 1_500
      end
      expect(page).to have_text("Total expenses $1,500", normalize_ws: true)
      expect(page).to have_text("Total $1,560", normalize_ws: true)
      click_on "Re-submit"
      wait_for_ajax

      invoice = Invoice.alive.last
      expect(invoice.total_amount_in_usd_cents).to eq(1_560_00)

      invoice_expense.reload
      expect(invoice.invoice_expenses.count).to eq(1)
      expect(invoice_expense.id).to eq(invoice_expense.id)
      expect(invoice_expense.invoice_id).to eq(invoice.id)
      expect(invoice_expense.description).to eq("British Airways")
      expect(invoice_expense.total_amount_in_cents).to eq(1_500_00)
      expect(invoice_expense.expense_category_id).to eq(expense_category.id)
    end

    context "when expenses flag is enabled" do
      let!(:invoice_expense) { create(:invoice_expense, invoice:, expense_category:) }

      before do
        Flipper.enable(:expenses, company)
        sleep 1
        refresh # ensure page is loaded with expenses flag enabled
      end

      after do
        Flipper.disable(:expenses, company)
      end

      it "allows updating an invoice with expenses", :sidekiq_inline do
        expect(page).to have_field("Invoice ID", with: "INV-1")
        expect(page).to have_field("Date", with: date)
        expect(page).to have_field("Description", with: invoice.invoice_line_items.last.description)
        expect(page).to have_text("Total services $60", normalize_ws: true)
        expect(page).to have_text("Total expenses $1,000", normalize_ws: true)
        expect(page).to have_text("Total $1,060", normalize_ws: true)

        within find(:table_row, { "Expense" => "expense.pdf" }) do
          expect(page).to have_select("Category", selected: "Travel")
          expect(page).to have_field("Merchant", with: "American Airlines")
          expect(page).to have_field("Amount", with: 1_000)
          fill_in "Merchant", with: "British Airways"
          fill_in "Amount", with: 1_500
        end

        attach_file "Add expense", [file_fixture("image.png"), file_fixture("sample.pdf")], visible: false
        click_on "Re-submit"
        wait_for_ajax
        expect(page).to have_text("Total services $60", normalize_ws: true)
        expect(page).to have_text("Total expenses $1,500", normalize_ws: true)
        expect(page).to have_text("Total $1,560", normalize_ws: true)
        within find(:table_row, { "Expense" => "image.png" }) do
          expect(page).to have_field("Merchant", valid: false)
          expect(page).to have_field("Amount", valid: false)
          select "Travel", from: "Category"
          fill_in "Merchant", with: "American Airlines"
          fill_in "Amount", with: 1_000
        end
        click_on "Re-submit"
        wait_for_ajax
        within find(:table_row, { "Expense" => "sample.pdf" }) do
          expect(page).to have_field("Merchant", valid: false)
          expect(page).to have_field("Amount", valid: false)
          click_on "Remove"
        end
        expect(page).to have_text("Total services $60", normalize_ws: true)
        expect(page).to have_text("Total expenses $2,500", normalize_ws: true)
        expect(page).to have_text("Total $2,560", normalize_ws: true)

        click_on "Re-submit"
        wait_for_ajax

        invoice = Invoice.alive.last
        expect(invoice.total_amount_in_usd_cents).to eq(2_560_00)

        invoice_expense.reload
        expect(invoice.invoice_expenses.count).to eq(2)
        expect(invoice_expense.id).to eq(invoice_expense.id)
        expect(invoice_expense.invoice_id).to eq(invoice.id)
        expect(invoice_expense.description).to eq("British Airways")
        expect(invoice_expense.total_amount_in_cents).to eq(1_500_00)
        expect(invoice_expense.expense_category_id).to eq(expense_category.id)
        expect(invoice_expense.attachment.filename).to eq("expense.pdf")

        invoice_expense_2 = invoice.invoice_expenses.find_by(description: "American Airlines")
        expect(invoice_expense_2.invoice_id).to eq(invoice.id)
        expect(invoice_expense_2.total_amount_in_cents).to eq(1_000_00)
        expect(invoice_expense_2.expense_category_id).to eq(expense_category.id)
        expect(invoice_expense_2.attachment.filename).to eq("image.png")
      end

      it "allows removing existing expenses" do
        expect(page).to have_field("Invoice ID", with: "INV-1")
        expect(page).to have_field("Date", with: date)
        expect(page).to have_field("Description", with: invoice.invoice_line_items.last.description)
        expect(page).to have_text("Total services $60", normalize_ws: true)
        expect(page).to have_text("Total expenses $1,000", normalize_ws: true)
        expect(page).to have_text("Total $1,060", normalize_ws: true)

        within find(:table_row, { "Expense" => "expense.pdf" }) do
          click_on "Remove"
        end

        expect do
          click_on "Re-submit"
          wait_for_ajax
        end.to change { invoice.reload.invoice_expenses.count }.by(-1)
      end
    end
  end

  shared_examples_for "invoice re-submission" do
    include_examples "common invoice re-submission specs", rate_type: :hourly, expected_minutes: 205

    it "allows re-submitting an invoice when it has an equity component" do
      create(:equity_allocation, :locked, company_worker: contractor, equity_percentage: 40, year:)
      invoice.update!(equity_percentage: 40)
      refresh # Refresh page to ensure equity changes^ are considered

      expect(page).to have_field("Invoice ID", with: "INV-1")
      expect(page).to have_field("Date", with: date)
      expect(page).to have_field("Description", with: invoice.invoice_line_items.last.description)
      expect(page).to have_field("Hours", with: humanized_duration(invoice))

      fill_in "Date", with: "08/08/#{year}"
      fill_in "Hours", with: "03:25"
      fill_in "Description", with: "I worked on invoices"

      expect(page).to have_text("Total services $205", normalize_ws: true)
      expect(page).to have_text("Swapped for equity (not paid in cash) $82", normalize_ws: true) # 40% of $205
      expect(page).to have_text("Net amount in cash $123", normalize_ws: true) # $205 - $82

      click_on "Re-submit"
      wait_for_ajax

      expect(page).to_not have_text("Rejected")
      expect(page).to have_text("Awaiting approval (0/2)")

      invoice = Invoice.alive.last
      expect(invoice.total_amount_in_usd_cents).to eq(205_00)
      expect(invoice.cash_amount_in_cents).to eq(123_00)
      expect(invoice.equity_amount_in_cents).to eq(82_00)
    end
  end

  context "when contractor is hourly-based" do
    let!(:contractor) do
      contractor = create(:company_worker, user:, company:)
      company_investor = create(:company_investor, company:, user:)
      create(:active_grant, company_investor:, share_price_usd: 1, year:)
      contractor
    end
    context "when contract is active" do
      context "when invoice is rejected" do
        let!(:invoice) do
          create(:invoice, invoice_number: "INV-1", invoice_date: Date.parse(date),
                           status: Invoice::REJECTED, company:, user:)
        end

        before do
          sign_in user
          visit spa_company_invoices_path(company.external_id)
          expect(page).to have_text("Rejected")
          click_on "Edit"
        end

        include_examples "invoice re-submission"
      end

      context "when invoice is received" do
        let!(:invoice) do
          create(:invoice, invoice_number: "INV-1", invoice_date: Date.parse(date),
                           status: Invoice::RECEIVED, company:, user:)
        end

        before do
          sign_in user
          visit spa_company_invoices_path(company.external_id)
          expect(page).to have_text("Awaiting approval (0/2)")
          click_on "Edit"
        end

        include_examples "invoice re-submission"
      end
    end

    context "when contract has ended" do
      context "and is within the notice period" do
        before do
          contractor.update!(ended_at: 1.day.ago)
        end

        context "when invoice is rejected" do
          let!(:invoice) do
            create(:invoice, invoice_number: "INV-1", invoice_date: Date.parse(date),
                             status: Invoice::REJECTED, company:, user:)
          end

          before do
            sign_in user
            visit spa_company_invoices_path(company.external_id)
            expect(page).to have_link("New invoice")
            expect(page).to have_text("Rejected")
            click_on "Edit"
          end

          include_examples "invoice re-submission"
        end

        context "when invoice is received" do
          let!(:invoice) do
            create(:invoice, invoice_number: "INV-1", invoice_date: Date.parse(date),
                             status: Invoice::RECEIVED, company:, user:)
          end

          before do
            sign_in user
            visit spa_company_invoices_path(company.external_id)
            expect(page).to have_link("New invoice")
            expect(page).to have_text("Awaiting approval (0/2)")
            click_on "Edit"
          end

          include_examples "invoice re-submission"
        end
      end

      context "and is past the notice period" do
        before do
          contractor.update!(ended_at: 1.day.ago)
        end

        context "when invoice is rejected" do
          let!(:invoice) do
            create(:invoice, invoice_number: "INV-1", invoice_date: Date.parse(date),
                             status: Invoice::REJECTED, company:, user:)
          end

          before do
            sign_in user
            visit spa_company_invoices_path(company.external_id)
            expect(page).to_not have_link("New invoice")
            expect(page).to_not have_link("Edit")
            expect(page).to have_text("Rejected")
          end
        end

        context "when invoice is received" do
          let!(:invoice) do
            create(:invoice, invoice_number: "INV-1", invoice_date: Date.parse(date),
                             status: Invoice::RECEIVED, company:, user:)
          end

          before do
            sign_in user
            visit spa_company_invoices_path(company.external_id)
            expect(page).to_not have_link("New invoice")
            expect(page).to_not have_link("Edit")
            expect(page).to have_text("Awaiting approval (0/2)")
          end
        end
      end
    end
  end

  context "when contractor is project-based" do
    let!(:contractor) { create(:company_worker, :project_based, company:, user:, pay_rate_usd: 205) }

    context "when contract is active" do
      context "when invoice is rejected" do
        let!(:invoice) do
          create(:invoice, :project_based, invoice_number: "INV-1", invoice_date: Date.parse(date),
                                           status: Invoice::REJECTED, company_worker: contractor)
        end

        before do
          sign_in user
          visit spa_company_invoices_path(company.external_id)
          expect(page).to have_text("Rejected")
          click_on "Edit"
        end

        include_examples "common invoice re-submission specs", rate_type: :project_based, expected_minutes: nil
      end

      context "when invoice is received" do
        let!(:invoice) do
          create(:invoice, :project_based, invoice_number: "INV-1", invoice_date: Date.parse(date),
                                           status: Invoice::RECEIVED, company_worker: contractor)
        end

        before do
          sign_in user
          visit spa_company_invoices_path(company.external_id)
          expect(page).to have_text("Awaiting approval (0/2)")
          click_on "Edit"
        end

        include_examples "common invoice re-submission specs", rate_type: :project_based, expected_minutes: nil
      end
    end
  end
end
