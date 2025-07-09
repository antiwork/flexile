# frozen_string_literal: true

RSpec.describe "Invoice creation flow" do
  let(:company) do
    company = create(:company)
    company.update!(equity_compensation_enabled: true)
    company
  end
  let(:user) do
    create(:user, :without_compliance_info, zip_code: "22222", street_address: "1st St.").tap do |user|
      create(:user_compliance_info, user:, business_entity: true, business_name: "Business Inc.")
    end
  end
  let(:year) { Date.current.year }

  shared_examples "common invoice creation specs" do |rate_type:, expected_minutes:|
    it "allows creation of an invoice" do
      visit new_spa_company_invoice_path(company.external_id)
      expect(page).to have_text(user.business_name)
      expect(page).to have_field("Invoice ID", with: "1")
      expect(page).to_not have_field("Add expense")

      fill_in "Invoice ID", with: ""
      click_on "Send invoice"
      expect(page).to have_field("Invoice ID", valid: false)

      fill_in "Invoice ID", with: "INV-123"
      expect(page).to have_field("Date", with: Date.current.strftime("%Y-%m-%d"))
      fill_in "Date", with: "08/08/2025"
      click_on "Send invoice"
      expect(page).to have_field("Description", valid: false)

      if rate_type == :hourly
        expect(page).to have_field("Hours", valid: false)
        fill_in "Hours", with: "03:25"
      elsif rate_type == :project_based
        fill_in "Amount", with: "205"
      end

      fill_in "Description", with: "I worked on invoices"

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

      expect(page).to have_text("Total $205", normalize_ws: true)

      click_on "Send invoice"
      wait_for_ajax

      invoice = Invoice.last
      expect(CreateInvoicePdfJob).to have_enqueued_sidekiq_job(invoice.id)
      invoice_line_item = invoice.invoice_line_items.last
      expect(invoice.invoice_number).to eq("INV-123")
      expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq("2025-08-08")
      expect(invoice_line_item.description).to eq("I worked on invoices")
      expect(invoice_line_item.minutes).to eq(expected_minutes)
      expect(invoice.total_minutes).to eq(expected_minutes)
      expect(invoice.total_amount_in_usd_cents).to eq(205_00)
    end

    context "when expenses flag is enabled" do
      let!(:expense_category) { create(:expense_category, company:) }

      before { Flipper.enable(:expenses, company) }

      it "allows creation of an invoice with expenses" do
        visit new_spa_company_invoice_path(company.external_id)
        fill_in "Description", with: "I worked on invoices"

        if rate_type == :hourly
          fill_in "Hours", with: "03:25\t"
        elsif rate_type == :project_based
          fill_in "Amount", with: "205\t"
        end

        expect(page).to have_text("Total $205", normalize_ws: true)

        attach_file "Add expense", [file_fixture("image.png"), file_fixture("sample.pdf")], visible: false
        expect(page).to have_text("Total services $205", normalize_ws: true)
        expect(page).to have_text("Total expenses $0", normalize_ws: true)
        expect(page).to have_text("Total $205", normalize_ws: true)
        click_on "Send invoice"
        within find(:table_row, { "Expense" => "image.png" }) do
          expect(page).to have_field("Merchant", valid: false)
          expect(page).to have_field("Amount", valid: false)
          select "Travel", from: "Category"
          fill_in "Merchant", with: "American Airlines"
          fill_in "Amount", with: 1000.99
        end
        click_on "Send invoice"
        within find(:table_row, { "Expense" => "sample.pdf" }) do
          expect(page).to have_field("Merchant", valid: false)
          expect(page).to have_field("Amount", valid: false)
          click_on "Remove"
        end
        expect(page).to have_text("Total services $205", normalize_ws: true)
        expect(page).to have_text("Total expenses $1,000.99", normalize_ws: true)
        expect(page).to have_text("Total $1,205", normalize_ws: true)

        expect do
          click_on "Send invoice"
          wait_for_ajax
        end.to change { Invoice.count }.by(1)
           .and change { InvoiceLineItem.count }.by(1)
           .and change { InvoiceExpense.count }.by(1)

        invoice = Invoice.alive.last
        invoice_expense = invoice.invoice_expenses.last
        expected_total_amount_in_usd_cents = invoice.invoice_line_items.sum(:total_amount_cents) + invoice_expense.total_amount_in_cents
        expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_usd_cents)

        expect(invoice_expense.invoice_id).to eq(invoice.id)
        expect(invoice_expense.description).to eq("American Airlines")
        expect(invoice_expense.total_amount_in_cents).to eq(1_000_99)
        expect(invoice_expense.expense_category_id).to eq(expense_category.id)
        expect(invoice_expense.attachment.filename).to eq("image.png")
      end
    end
  end

  shared_examples_for "creation of an invoice" do
    include_examples "common invoice creation specs", rate_type: :hourly, expected_minutes: 205

    context "when expenses flag is enabled" do
      let!(:expense_category) { create(:expense_category, company:) }

      before { Flipper.enable(:expenses, company) }

      it "creates an invoice with expenses and an equity component" do
        create(:equity_allocation, :locked, company_worker: contractor, equity_percentage: 30, year:)

        visit new_spa_company_invoice_path(company.external_id)
        fill_in "Description", with: "I worked on invoices"
        fill_in "Date", with: "08/08/#{year}"
        fill_in "Hours", with: "03:25\t"

        attach_file "Add expense", [file_fixture("image.png"), file_fixture("sample.pdf")], visible: false
        expect(page).to have_text("Total services $205", normalize_ws: true)
        expect(page).to have_text("Total expenses $0", normalize_ws: true)
        expect(page).to have_text("Swapped for equity (not paid in cash) $61.50", normalize_ws: true) # 30% of $205
        expect(page).to have_text("Net amount in cash $143.50", normalize_ws: true) # $205 - $61.50
        click_on "Send invoice"
        within find(:table_row, { "Expense" => "image.png" }) do
          select "Travel", from: "Category"
          fill_in "Merchant", with: "American Airlines"
          fill_in "Amount", with: 1000.99
        end
        within find(:table_row, { "Expense" => "sample.pdf" }) do
          click_on "Remove"
        end
        expect(page).to have_text("Total services $205", normalize_ws: true)
        expect(page).to have_text("Total expenses $1,000.99", normalize_ws: true)
        expect(page).to have_text("Swapped for equity (not paid in cash) $61.50", normalize_ws: true)
        expect(page).to have_text("Net amount in cash $1,144.49", normalize_ws: true) # $205 + $1000.99 - $61.50

        expect do
          click_on "Send invoice"
          wait_for_ajax
        end.to change { Invoice.count }.by(1)
           .and change { InvoiceLineItem.count }.by(1)
           .and change { InvoiceExpense.count }.by(1)

        invoice = Invoice.alive.last
        expect(invoice.total_minutes).to eq(205)
        expect(invoice.total_amount_in_usd_cents).to eq(1_205_99)
        expect(invoice.cash_amount_in_cents).to eq(1144_49)
        expect(invoice.equity_amount_in_cents).to eq(61_50)
        expect(invoice.equity_percentage).to eq(30)
      end
    end
  end

  context "when contractor is hourly-based" do
    let(:company_investor) { create(:company_investor, company:, user:) }
    let!(:equity_grant) { create(:active_grant, company_investor:, share_price_usd: 1, year:) }
    let!(:contractor) { create(:company_worker, user:, company:, pay_rate_usd: 60) }

    context "when contract is active" do
      before do
        sign_in user
      end

      include_examples "creation of an invoice"

      it "converts from user entered durations to our format of durations as expected" do
        visit new_spa_company_invoice_path(company.external_id)
        [%w[:205 03:25],
         %w[10: 10:00],
         %w[11 11:00],
         %w[11:65 12:05],
         %w[13:5 13:05],
         ["abc:w", ""]
        ].each do |input, expected|
          fill_in "Hours", with: input
          click_on "Send invoice"
          expect(page).to have_field("Hours", with: expected)
        end
      end

      context "when hourly rate + total minutes are not round" do
        before { contractor.update!(pay_rate_usd: 133) }

        it "persists the same total amount as displayed" do
          visit new_spa_company_invoice_path(company.external_id)

          fill_in "Invoice ID", with: "INV-123"
          fill_in "Date", with: "08/08/2025"
          fill_in "Hours", with: "33:33"
          fill_in "Description", with: "I worked on invoices"

          expect(page).to have_text("$4,462.15")

          click_on "Send invoice"

          wait_for_ajax
          expect(page).to have_text("$4,462.15")
        end
      end
    end

    context "when contract has ended" do
      before do
        contractor.update!(ended_at: 1.day.ago)

        sign_in user
      end

      include_examples "creation of an invoice"
    end
  end

  context "when contractor is project-based" do
    let!(:contractor) { create(:company_worker, :project_based, user:, company:, pay_rate_usd: 1_000) }

    context "when contract is active" do
      before do
        sign_in user
      end

      include_examples "common invoice creation specs", rate_type: :project_based, expected_minutes: nil
    end

    context "when contract has ended" do
      before do
        contractor.update!(ended_at: 1.day.ago)

        sign_in user
      end

      include_examples "common invoice creation specs", rate_type: :project_based, expected_minutes: nil
    end
  end
end
