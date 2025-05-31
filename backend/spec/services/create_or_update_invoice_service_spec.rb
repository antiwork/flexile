# frozen_string_literal: true

RSpec.describe CreateOrUpdateInvoiceService do
  let(:company_administrator) { create(:company_administrator, company:) }
  let(:company) { create(:company) }
  let!(:expense_category) { create(:expense_category, company:) }
  let(:contractor) { create(:company_worker, company:) }
  let(:user) { contractor.user }
  let(:date) { Date.current }
  let(:invoice_params) do
    {
      invoice: {
        invoice_date: date.to_s,
        invoice_number: "INV-123",
        notes: "Tax ID: 123efjo32r",
      },
    }
  end
  let(:invoice_line_item_params) do
    {
      invoice_line_items: [
        {
          description: "I worked on XYZ",
          minutes: 720,
        }
      ],
    }
  end
  let(:invoice_service) { described_class.new(params:, user:, company:, contractor:, invoice:) }
  let!(:equity_grant) do
    create(:active_grant, company_investor: create(:company_investor, company:, user:),
                          share_price_usd: 2.34, year: Date.current.year)
  end

  before { company.update!(equity_compensation_enabled: true) }

  shared_examples "common invoice failure specs" do |expected_invoices_count:|
    it "allows creating an invoice with empty notes" do
      params[:invoice][:notes] = "   "
      expect do
        result = invoice_service.process
        expect(result[:invoice].notes).to eq("   ")
      end.to change { user.invoices.count }.by(expected_invoices_count)
    end

    it "allows creating an invoice without notes" do
      params[:invoice].delete(:notes)
      expect do
        result = invoice_service.process
        expect(result[:invoice].notes).to eq(nil)
      end.to change { user.invoices.count }.by(expected_invoices_count)
    end

    it "returns an error when invoice line item description is missing" do
      params[:invoice_line_items][0][:description] = ""
      expect do
        result = invoice_service.process
        expect(result[:error_message]).to eq("Please input all values")
      end.to_not change { user.invoices.count }
    end
  end

  describe "#process" do
    describe "creating an invoice" do
      let(:invoice) { nil }
      let(:params) { ActionController::Parameters.new({ **invoice_params, **invoice_line_item_params }) }

      it "creates an invoice with valid params" do
        # Update hourly rate and minutes to assert rounding of amounts
        pay_rate_in_subunits = 50_00
        contractor.update!(pay_rate_in_subunits:)
        params[:invoice_line_items][0][:minutes] = 34
        # Ensure pay rate and total amount params are ignored
        params[:invoice_line_items][0][:pay_rate_in_subunits] = 100_00
        params[:invoice_line_items][0][:total_amount_cents] = 100_00

        expect do
          result = invoice_service.process
          expect(result[:success]).to be(true)

          invoice = result[:invoice]
          invoice_line_item = invoice.invoice_line_items.first
          expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
          expect(invoice.invoice_number).to eq("INV-123")
          expect(invoice.company_worker).to eq(contractor)
          expect(invoice_line_item.description).to eq("I worked on XYZ")
          expect(invoice_line_item.minutes).to eq(34)
          expect(invoice_line_item.pay_rate_in_subunits).to eq(pay_rate_in_subunits)
          expect(invoice.total_minutes).to eq(34)
          expected_total_amount_in_cents = 28_34 # hours X hourly rate in cents = (34 / 60.0) * 50_00
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.equity_percentage).to eq(0)
          expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.flexile_fee_cents).to eq((50 + (0.015 * expected_total_amount_in_cents)).round)
          expect(invoice.equity_amount_in_cents).to eq(0)
          expect(invoice.equity_amount_in_options).to eq(0)
          expect(invoice.notes).to eq("Tax ID: 123efjo32r")
          expect(invoice.street_address).to eq(user.street_address)
          expect(invoice.city).to eq(user.city)
          expect(invoice.state).to eq(user.state)
          expect(invoice.zip_code).to eq(user.zip_code)
          expect(invoice.country_code).to eq(user.country_code)
        end.to change { user.invoices.count }.by(1)
      end

      it "does not create an invoice with no line items" do
        params[:invoice_line_items] = []
        expect do
          result = invoice_service.process
          expect(result[:success]).to be(false)
          expect(result[:error_message]).to eq("Total amount in usd cents must be greater than 99")
        end.to_not change { user.invoices.count }
      end

      it "calculates the amounts correctly if the contractor has opted for some compensation in equity" do
        create(:equity_allocation, company_worker: contractor, equity_percentage: 60, year: date.year)

        expect do
          result = invoice_service.process
          expect(result[:success]).to be(true)
          invoice = result[:invoice]
          expect(invoice.total_minutes).to eq(720)
          expected_total_amount_in_cents = 720_00 # hours X hourly rate in cents = (720 / 60) * 60_00
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.equity_percentage).to eq(60)
          expected_equity_cents = 43_200 # $720 * 0.6
          expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
          expected_cash_cents = 28_800 # invoice.total_amount_in_usd_cents - expected_equity_cents
          expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_cents / 100.0))
          expected_options = 185 # (expected_equity_cents / (company.share_price_in_usd * 100)).round
          expect(invoice.equity_amount_in_options).to eq(expected_options)
          equity_allocation = contractor.equity_allocation_for(date.year)
          expect(equity_allocation.status).to eq("pending_grant_creation")
          expect(equity_allocation.locked?).to be(true)
        end.to change { user.invoices.count }.by(1)
      end

      it "does not apply an equity split if the equity portion makes up less than one share" do
        create(:equity_allocation, company_worker: contractor, equity_percentage: 1, year: date.year)
        equity_grant.update!(share_price_usd: 14.90)

        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)
          invoice = result[:invoice]
          expect(invoice.total_minutes).to eq(720)
          expected_total_amount_in_cents = 72_000 # hours X hourly rate in cents = (720 / 60) * 60_00
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)

          # Equity portion = $720 * 1% = $7.20
          # Shares = $7.20 / $14.9 = 0.4832214765100671 = 0 (rounded)
          # Don't allocate any portion to equity as the number of shares comes to 0
          expect(invoice.equity_amount_in_options).to eq(0)
          expect(invoice.equity_percentage).to eq(0)
          expect(invoice.equity_amount_in_cents).to eq(0)
          expect(invoice.cash_amount_in_cents).to eq(720_00)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * 720_00 / 100))
          equity_allocation = contractor.equity_allocation_for(date.year)
          expect(equity_allocation.status).to eq("pending_grant_creation")
          expect(equity_allocation.locked?).to be(true)
        end.to change { user.invoices.count }.by(1)
      end

      it "does not apply an equity split if the feature is not enabled" do
        create(:equity_allocation, company_worker: contractor, equity_percentage: 60, year: date.year)
        company.update!(equity_compensation_enabled: false)

        expect do
          result = invoice_service.process
          expect(result[:success]).to be(true)
          invoice = result[:invoice]
          invoice_line_item = invoice.invoice_line_items.first
          expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
          expect(invoice.invoice_number).to eq("INV-123")
          expect(invoice_line_item.description).to eq("I worked on XYZ")
          expect(invoice_line_item.minutes).to eq(12 * 60)
          expect(invoice_line_item.pay_rate_in_subunits).to eq(contractor.pay_rate_in_subunits)
          expect(invoice.total_minutes).to eq(12 * 60)
          expected_total_amount_in_usd = (invoice.total_minutes / 60) * (contractor.pay_rate_in_subunits / 100.0)
          expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
          expect(invoice.equity_percentage).to eq(0)
          expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_usd * 100)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_usd))
          expect(invoice.equity_amount_in_cents).to eq(0)
          expect(invoice.equity_amount_in_options).to eq(0)
          expect(invoice.notes).to eq("Tax ID: 123efjo32r")
        end.to change { user.invoices.count }.by(1)
      end

      it "fails to create an invoice if an active grant is missing, company does not have a share price, and the contractor has an equity percentage" do
        create(:equity_allocation, company_worker: contractor, equity_percentage: 20, year: date.year)
        equity_grant.destroy!
        company.update!(fmv_per_share_in_usd: nil)

        expect(Bugsnag).to receive(:notify).with("InvoiceEquityCalculator: Error determining share price for CompanyWorker #{contractor.id}")
        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(false)
          expect(result[:error_message]).to eq("Something went wrong. Please contact the company administrator.")
        end.to_not change(user.invoices, :count)
      end

      include_examples "common invoice failure specs", expected_invoices_count: 1

      context "when contractor is project-based" do
        let(:contractor) { create(:company_worker, :project_based, company:) }
        let(:user) { contractor.user }
        let(:invoice_line_item_params) do
          {
            invoice_line_items: [
              {
                description: "I worked on XYZ",
                total_amount_cents: 1_000_00,
              }
            ],
          }
        end

        before { EquityGrant.destroy_all }

        it "creates an invoice with valid params" do
          # Ensure minutes param is ignored
          params[:invoice_line_items][0][:minutes] = 60

          expect do
            result = invoice_service.process
            expect(result[:success]).to be(true)
            invoice = result[:invoice]
            invoice_line_item = invoice.invoice_line_items.first
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice_line_item.description).to eq("I worked on XYZ")
            expect(invoice_line_item.minutes).to eq(nil)
            expect(invoice_line_item.pay_rate_in_subunits).to eq(1_000_00)
            expect(invoice_line_item.total_amount_cents).to eq(1_000_00)
            expect(invoice.total_minutes).to eq(nil)
            expect(invoice.total_amount_in_usd).to eq(1_000)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(1_000_00)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expect(invoice.equity_amount_in_cents).to eq(0)
            expect(invoice.equity_amount_in_options).to eq(0)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)
          end.to change { user.invoices.count }.by(1)
        end

        it "returns an error when invoice line item description is missing" do
          params[:invoice_line_items] = [{ description: "", total_amount_cents: 1_000_00 }]
          result = invoice_service.process
          expect(result[:error_message]).to eq("Please input all values")
        end

        include_examples "common invoice failure specs", expected_invoices_count: 1
      end

      context "when invoice_expenses param exists" do
        let(:params) do
          ActionController::Parameters.new(
            {
              **invoice_params,
              **invoice_line_item_params,
              invoice_expenses: [
                {
                  description: "Air Canada",
                  total_amount_in_cents: 1_000_00,
                  expense_category_id: expense_category.id,
                  attachment: fixture_file_upload("image.png", "image/png"),
                }
              ],
            }
          )
        end

        it "creates an invoice with expenses" do
          expect do
            result = invoice_service.process
            invoice = result[:invoice]
            invoice_line_item = invoice.invoice_line_items.first
            invoice_expense = invoice.invoice_expenses.first

            expect(invoice.invoice_expenses.count).to eq(1)
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice_line_item.description).to eq("I worked on XYZ")
            expect(invoice_line_item.minutes).to eq(12 * 60)
            expect(invoice_line_item.pay_rate_in_subunits).to eq(contractor.pay_rate_in_subunits)
            expect(invoice.total_minutes).to eq(12 * 60)
            expected_total_amount_in_usd = (invoice.total_minutes / 60) * (contractor.pay_rate_in_subunits / 100.0) + invoice_expense.total_amount_in_cents / 100.0
            expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_usd * 100)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expect(invoice.equity_amount_in_cents).to eq(0)
            expect(invoice.equity_amount_in_options).to eq(0)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)

            expect(invoice_expense.invoice_id).to eq(invoice.id)
            expect(invoice_expense.description).to eq("Air Canada")
            expect(invoice_expense.total_amount_in_cents).to eq(1_000_00)
            expect(invoice_expense.expense_category_id).to eq(expense_category.id)
            expect(invoice_expense.attachment.filename).to eq("image.png")
          end.to change { user.invoices.count }.by(1)
             .and change { InvoiceExpense.count }.by(1)
        end

        it "allows creating an expense-only invoice" do
          params[:invoice_line_items] = []
          expect do
            result = invoice_service.process
            invoice = result[:invoice]
            invoice_expense = invoice.invoice_expenses.first

            expect(invoice.invoice_line_items.count).to eq(0)
            expect(invoice.invoice_expenses.count).to eq(1)
            expect(invoice.total_minutes).to eq(0)
            expect(invoice.total_amount_in_usd).to eq(1_000)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(1_000_00)
            expect(invoice.flexile_fee_cents).to eq(15_00)
            expect(invoice.equity_amount_in_cents).to eq(0)
            expect(invoice.equity_amount_in_options).to eq(0)
            expect(invoice_expense.invoice_id).to eq(invoice.id)
            expect(invoice_expense.description).to eq("Air Canada")
            expect(invoice_expense.total_amount_in_cents).to eq(1_000_00)
            expect(invoice_expense.expense_category_id).to eq(expense_category.id)
            expect(invoice_expense.attachment.filename).to eq("image.png")
          end.to change { user.invoices.count }.by(1)
        end

        it "calculates the amounts correctly if the contractor has opted for some compensation in equity" do
          create(:equity_allocation, company_worker: contractor, equity_percentage: 30, year: date.year)

          expect do
            result = invoice_service.process
            invoice = result[:invoice]
            expect(invoice.total_minutes).to eq(720)
            expect(invoice.invoice_expenses.count).to eq(1)
            expected_total_amount_in_usd = 1_720 # services amount + expenses = 720 + 1000
            expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
            expect(invoice.equity_percentage).to eq(30)
            expected_equity_cents = 21_600 # $720 * 0.3
            expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
            expected_cash_cents = 150_400 # invoice.total_amount_in_usd_cents - expected_equity_cents
            expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expected_options = 92 # (expected_equity_cents / (company.share_price_in_usd * 100)).floor
            expect(invoice.equity_amount_in_options).to eq(expected_options)
            equity_allocation = contractor.equity_allocation_for(date.year)
            expect(equity_allocation.status).to eq("pending_grant_creation")
            expect(equity_allocation.locked?).to be(true)
          end.to change { user.invoices.count }.by(1)
        end
      end

      context "and is in the notice period" do
        before do
          contractor.update!(ended_at: 1.day.ago)
        end

        it "creates the invoice successfully" do
          expect do
            result = invoice_service.process
            invoice = result[:invoice]
            invoice_line_item = invoice.invoice_line_items.first
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice_line_item.description).to eq("I worked on XYZ")
            expect(invoice_line_item.minutes).to eq(12 * 60)
            expect(invoice_line_item.pay_rate_in_subunits).to eq(contractor.pay_rate_in_subunits)
            expect(invoice.total_minutes).to eq(12 * 60)
            expected_total_amount_in_usd = (invoice.total_minutes / 60) * contractor.pay_rate_in_subunits / 100.0
            expect(invoice_line_item.total_amount_cents).to eq(expected_total_amount_in_usd * 100)
            expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)
          end.to change(user.invoices, :count).by(1)
        end
      end
    end

    describe "updating an invoice" do
      let!(:invoice) { create(:invoice, company:, user:) }
      let(:invoice_line_item) { invoice.invoice_line_items.first! }
      let(:invoice_line_item_params) do
        {
          invoice_line_items: [
            {
              id: invoice_line_item.id,
              description: "I worked on XYZ",
              minutes: 720,
            }
          ],
        }
      end
      let(:params) { ActionController::Parameters.new({ **invoice_params, **invoice_line_item_params }) }

      it "updates an invoice with valid params" do
        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)

          expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
          expect(invoice.invoice_number).to eq("INV-123")
          expect(invoice_line_item.reload.description).to eq("I worked on XYZ")
          expect(invoice_line_item.minutes).to eq(12 * 60)
          expect(invoice_line_item.pay_rate_in_subunits).to eq(contractor.pay_rate_in_subunits)
          expect(invoice.total_minutes).to eq(12 * 60)
          expected_total_amount_in_usd = (invoice.total_minutes / 60) * contractor.pay_rate_in_subunits / 100.0
          expect(invoice_line_item.total_amount_cents).to eq(expected_total_amount_in_usd * 100)
          expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
          expect(invoice.equity_percentage).to eq(0)
          expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_usd * 100)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_usd))
          expect(invoice.equity_amount_in_cents).to eq(0)
          expect(invoice.equity_amount_in_options).to eq(0)
          expect(invoice.notes).to eq("Tax ID: 123efjo32r")
          expect(invoice.street_address).to eq(user.street_address)
          expect(invoice.city).to eq(user.city)
          expect(invoice.state).to eq(user.state)
          expect(invoice.zip_code).to eq(user.zip_code)
          expect(invoice.country_code).to eq(user.country_code)
        end.to change { user.invoices.count }.by(0)
          .and change { invoice.reload.attachments.count }.to(0)
      end

      it "updates the invoice address when the contractor has changed it" do
        user.update!(street_address: "123 2nd Ave", city: "New York", state: "NY", zip_code: "10001")

        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)
          expect(invoice.reload.street_address).to eq("123 2nd Ave")
          expect(invoice.city).to eq("New York")
          expect(invoice.state).to eq("NY")
          expect(invoice.zip_code).to eq("10001")
          expect(invoice.country_code).to eq(user.country_code)
        end.to change { user.invoices.count }.by(0)
      end

      it "updates the amounts correctly if the contractor has opted for some compensation in equity" do
        create(:equity_allocation, :locked, company_worker: contractor, equity_percentage: 60, year: date.year)

        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)
          invoice.reload
          expect(invoice.total_minutes).to eq(720)
          expected_total_amount_in_usd = 720 # hours X hourly rate = (720 / 60) * 60
          expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
          expect(invoice.equity_percentage).to eq(60)
          expected_equity_cents = 43_200 # $720 * 0.6
          expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
          expected_cash_cents = 28_800 # invoice.total_amount_in_usd_cents - expected_equity_cents
          expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_usd))
          expected_options = 185 # (expected_equity_cents / (company.share_price_in_usd * 100)).round
          expect(invoice.equity_amount_in_options).to eq(expected_options)
        end.to change { user.invoices.count }.by(0)
      end

      it "returns an error message when invoice line item minutes are zero" do
        params[:invoice_line_items] = [{ description: "I worked on XYZ", minutes: 0 }]
        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(false)
          expect(result[:error_message]).to eq(
            "Invoice line items total amount cents must be greater than 0, Invoice line items minutes must be greater than 0, and Total amount in usd cents must be greater than 99"
          )
          expect(user.invoices.count).to eq(1)
        end.to_not change { invoice_line_item.reload.minutes }
      end

      include_examples "common invoice failure specs", expected_invoices_count: 0

      context "when line items were removed" do
        before do
          create(:invoice_line_item, invoice:)
          invoice.reload
        end

        it "deletes the line item from the invoice" do
          expect do
            result = invoice_service.process
            expect(result[:success]).to eq(true)
          end.to change { invoice.invoice_line_items.count }.by(-1)
        end
      end

      context "when invoice_expenses param exists" do
        let!(:invoice_expense) { create(:invoice_expense, invoice:, expense_category:) }
        let!(:another_invoice_expense) { create(:invoice_expense, invoice:, expense_category:, description: "Uber", total_amount_in_cents: 50_00) }
        let(:params) do
          ActionController::Parameters.new(
            {
              **invoice_params,
              **invoice_line_item_params,
              invoice_expenses: [
                {
                  id: invoice_expense.id,
                  description: "American Airlines",
                  total_amount_in_cents: 500_00,
                  expense_category_id: expense_category.id,
                },
                {
                  description: "Air Canada",
                  total_amount_in_cents: 1_500_00,
                  expense_category_id: expense_category.id,
                  attachment: fixture_file_upload("image.png", "image/png"),
                }
              ],
            }
          )
        end

        it "updates an invoice with expenses" do
          expect do
            result = invoice_service.process
            expect(result[:success]).to eq(true)
            invoice = result[:invoice]

            invoice_line_item = invoice.invoice_line_items.first
            expense_1, expense_2 = invoice.invoice_expenses.to_a

            expect(invoice.invoice_expenses.count).to eq(2)
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice_line_item.reload.description).to eq("I worked on XYZ")
            expect(invoice_line_item.minutes).to eq(12 * 60)
            expect(invoice_line_item.pay_rate_in_subunits).to eq(contractor.pay_rate_in_subunits)
            expect(invoice_line_item.total_amount_cents).to eq(12 * contractor.pay_rate_in_subunits)
            expect(invoice.total_minutes).to eq(12 * 60)
            expected_total_amount_in_usd = (invoice.total_minutes / 60) * contractor.pay_rate_in_subunits / 100.0 + expense_1.total_amount_in_cents / 100.0 + expense_2.total_amount_in_cents / 100.0
            expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_usd * 100)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expect(invoice.equity_amount_in_cents).to eq(0)
            expect(invoice.equity_amount_in_options).to eq(0)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)

            expect(expense_1.id).to eq(invoice_expense.id)
            expect(expense_1.invoice_id).to eq(invoice.id)
            expect(expense_1.description).to eq("American Airlines")
            expect(expense_1.total_amount_in_cents).to eq(500_00)
            expect(expense_1.expense_category_id).to eq(expense_category.id)
            expect(expense_1.attachment.filename).to eq("expense.pdf")

            expect(expense_2.id).to_not eq(invoice_expense.id)
            expect(expense_2.invoice_id).to eq(invoice.id)
            expect(expense_2.description).to eq("Air Canada")
            expect(expense_2.total_amount_in_cents).to eq(1_500_00)
            expect(expense_2.expense_category_id).to eq(expense_category.id)
            expect(expense_2.attachment.filename).to eq("image.png")
          end.to change { user.invoices.count }.by(0)
            .and change { invoice.reload.invoice_expenses.count }.by(0)
            .and change { invoice.attachments.count }.to(0)
        end

        it "updates the amounts correctly if the contractor has opted for some compensation in equity" do
          create(:equity_allocation, :locked, company_worker: contractor, equity_percentage: 30, year: date.year)

          expect do
            result = invoice_service.process
            expect(result[:success]).to be(true)
            invoice.reload
            expect(invoice.total_minutes).to eq(720)
            expect(invoice.invoice_expenses.count).to eq(2)
            expected_total_amount_in_usd = 2_720 # services amount + expenses = 720 + 2000
            expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
            expect(invoice.equity_percentage).to eq(30)
            expected_equity_cents = 21_600 # $720 * 0.3
            expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
            expected_cash_cents = 250_400 # invoice.total_amount_in_usd_cents - expected_equity_cents
            expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expected_options = 92 # (expected_equity_cents / (company.share_price_in_usd * 100)).round
            expect(invoice.equity_amount_in_options).to eq(expected_options)
            expect(contractor.equity_allocation_for(date.year).locked?).to eq(true)
          end.to change { user.invoices.count }.by(0)
        end
      end

      context "and is in the notice period" do
        before do
          contractor.update!(ended_at: 1.day.ago)
        end

        it "updates the invoice successfully" do
          expect do
            result = invoice_service.process
            expect(result[:success]).to be(true)
            expect(invoice.reload.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice_line_item.reload.description).to eq("I worked on XYZ")
            expect(invoice_line_item.minutes).to eq(12 * 60)
            expect(invoice_line_item.pay_rate_in_subunits).to eq(contractor.pay_rate_in_subunits)
            expect(invoice_line_item.total_amount_cents).to eq(12 * contractor.pay_rate_in_subunits)
            expect(invoice.total_minutes).to eq(12 * 60)
            expected_total_amount_in_usd = (invoice.total_minutes / 60) * contractor.pay_rate_in_subunits / 100.0
            expect(invoice.total_amount_in_usd).to eq(expected_total_amount_in_usd)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)
          end.to_not change { user.invoices.count }
        end
      end

      context "when contractor is project-based" do
        let(:contractor) { create(:company_worker, :project_based, company:) }
        let(:user) { contractor.user }
        let!(:invoice) { create(:invoice, :project_based, company_worker: contractor) }
        let(:invoice_line_item) { invoice.invoice_line_items.first! }
        let(:invoice_line_item_params) do
          {
            invoice_line_items: [
              {
                id: invoice_line_item.id,
                description: "I worked on XYZ",
                total_amount_cents: 1_500_00,
              }
            ],
          }
        end

        before { EquityGrant.destroy_all }

        it "updates an invoice with valid params" do
          # Ensure minutes param is ignored
          params[:invoice_line_items][0][:minutes] = 60

          expect do
            result = invoice_service.process
            expect(result[:success]).to eq(true)
            invoice = result[:invoice]

            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice_line_item.reload.description).to eq("I worked on XYZ")
            expect(invoice_line_item.minutes).to eq(nil)
            expect(invoice_line_item.pay_rate_in_subunits).to eq(1_000_00)
            expect(invoice_line_item.pay_rate_currency).to eq("usd")
            expect(invoice.total_minutes).to eq(nil)
            expect(invoice.total_amount_in_usd).to eq(1_500)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(1_500_00)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expect(invoice.equity_amount_in_cents).to eq(0)
            expect(invoice.equity_amount_in_options).to eq(0)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)
          end.to change { user.invoices.count }.by(0)
             .and change { invoice.reload.attachments.count }.to(0)
        end

        include_examples "common invoice failure specs", expected_invoices_count: 0
      end
    end
  end
end
