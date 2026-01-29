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
          pay_rate_in_subunits: contractor.pay_rate_in_subunits,
          quantity: 121,
          hourly: true,
        },
        {
          description: "I also did ABC",
          pay_rate_in_subunits: 1000,
          quantity: 2,
        }
      ],
    }
  end
  let(:invoice_service) { described_class.new(params:, user:, company:, contractor:, invoice:) }
  let!(:equity_grant) do
    create(:active_grant, company_investor: create(:company_investor, company:, user:),
                          share_price_usd: 2.34, year: Date.current.year)
  end
  let(:expected_total_amount_in_cents) { 14101 }

  before { company.update!(equity_enabled: true) }

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
        expect(result[:error_message]).to eq("Invoice line items description can't be blank")
      end.to_not change { user.invoices.count }
    end
  end

  describe "#process" do
    describe "creating an invoice" do
      let(:invoice) { nil }
      let(:params) { ActionController::Parameters.new({ **invoice_params, **invoice_line_item_params }) }

      it "creates an invoice with valid params" do
        expect do
          result = invoice_service.process
          expect(result[:success]).to be(true)

          invoice = result[:invoice]
          expect(invoice.invoice_line_items).to match([
                                                        an_object_having_attributes(description: "I worked on XYZ", quantity: BigDecimal("121"), hourly: true, pay_rate_in_subunits: contractor.pay_rate_in_subunits),
                                                        an_object_having_attributes(description: "I also did ABC", quantity: BigDecimal("2"), hourly: false, pay_rate_in_subunits: 1000),
                                                      ])
          expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
          expect(invoice.invoice_number).to eq("INV-123")
          expect(invoice.company_worker).to eq(contractor)
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

      it "creates an invoice with a single attachment" do
        # Use direct params instead of invoice_params
        params_with_attachment = ActionController::Parameters.new({
          **invoice_params,
          **invoice_line_item_params,
          invoice: {
            **invoice_params[:invoice],
            attachment: fixture_file_upload("sample.pdf", "application/pdf"),
          },
        })
        invoice_service_with_attachment = described_class.new(
          params: params_with_attachment,
          user: user,
          company: company,
          contractor: contractor,
          invoice: nil
        )

        expect do
          result = invoice_service_with_attachment.process
          expect(result[:success]).to be(true)

          invoice = result[:invoice]
          expect(invoice.attachments.count).to eq(1)
          expect(invoice.attachments.first.filename.to_s).to eq("sample.pdf")
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
        contractor.update!(equity_percentage: 60)
        expect do
          result = invoice_service.process
          expect(result[:success]).to be(true)
          invoice = result[:invoice]
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.equity_percentage).to eq(60)
          expected_equity_cents = 8461
          expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
          expected_cash_cents = 5640
          expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_cents / 100.0).round)
          expected_options = 36 # (expected_equity_cents / (company.share_price_in_usd * 100)).round
          expect(invoice.equity_amount_in_options).to eq(expected_options)
        end.to change { user.invoices.count }.by(1)
      end

      it "does not apply an equity split if the equity portion makes up less than one share" do
        contractor.update!(equity_percentage: 1)
        equity_grant.update!(share_price_usd: 20)

        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)
          invoice = result[:invoice]

          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.equity_amount_in_options).to eq(0)
          expect(invoice.equity_percentage).to eq(0)
          expect(invoice.equity_amount_in_cents).to eq(0)
          expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_cents / 100).round)
        end.to change { user.invoices.count }.by(1)
      end


      it "fails to create an invoice if an active grant is missing, company does not have a share price, and the contractor has an equity percentage" do
        contractor.update!(equity_percentage: 20)
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
            invoice_expense = invoice.invoice_expenses.first

            expect(invoice.invoice_expenses.count).to eq(1)
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice.invoice_line_items.length).to eq(2)
            expected_total_amount = expected_total_amount_in_cents + invoice_expense.total_amount_in_cents
            expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(expected_total_amount)
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
          contractor.update!(equity_percentage: 30)

          expect do
            result = invoice_service.process
            invoice = result[:invoice]
            invoice_expense = invoice.invoice_expenses.first
            expect(invoice.invoice_expenses.count).to eq(1)
            expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents + invoice_expense.total_amount_in_cents)
            expect(invoice.equity_percentage).to eq(30)
            expected_equity_cents = (expected_total_amount_in_cents * 0.3).round
            expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
            expected_cash_cents = expected_total_amount_in_cents + invoice_expense.total_amount_in_cents - expected_equity_cents
            expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expected_options = 18 # (expected_equity_cents / (company.share_price_in_usd * 100)).floor
            expect(invoice.equity_amount_in_options).to eq(expected_options)
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
            expect(invoice.invoice_line_items.length).to eq(2)
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
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
      let(:params) { ActionController::Parameters.new({ **invoice_params, **invoice_line_item_params }) }

      it "updates an invoice with valid params" do
        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)

          expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
          expect(invoice.invoice_number).to eq("INV-123")
          expect(invoice.invoice_line_items).to match([
                                                        an_object_having_attributes(description: "I worked on XYZ", quantity: BigDecimal("121"), hourly: true, pay_rate_in_subunits: contractor.pay_rate_in_subunits),
                                                        an_object_having_attributes(description: "I also did ABC", quantity: BigDecimal("2"), hourly: false, pay_rate_in_subunits: 1000),
                                                      ])
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.equity_percentage).to eq(0)
          expect(invoice.cash_amount_in_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_cents / 100).round)
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

      it "updates an invoice with a single attachment" do
        # Make sure there are no existing attachments
        invoice.attachments.purge
        invoice.reload
        expect(invoice.attachments.count).to eq(0)

        # Use direct params instead of invoice_params
        params_with_attachment = ActionController::Parameters.new({
          **invoice_params,
          **invoice_line_item_params,
          invoice: {
            **invoice_params[:invoice],
            attachment: fixture_file_upload("sample.pdf", "application/pdf"),
          },
        })
        invoice_service_with_attachment = described_class.new(
          params: params_with_attachment,
          user: user,
          company: company,
          contractor: contractor,
          invoice: invoice
        )

        expect do
          result = invoice_service_with_attachment.process
          expect(result[:success]).to eq(true)

          invoice.reload
          expect(invoice.attachments.count).to eq(1)
          expect(invoice.attachments.first.filename.to_s).to eq("sample.pdf")
        end.to change { user.invoices.count }.by(0)
          .and change { invoice.reload.attachments.count }.by(1)
      end

      it "replaces the existing attachment with a new one" do
        # Make sure there are no existing attachments
        invoice.attachments.purge
        invoice.reload
        expect(invoice.attachments.count).to eq(0)

        # First add an attachment
        invoice.attachments.attach(fixture_file_upload("sample.pdf", "application/pdf"))
        invoice.reload
        expect(invoice.attachments.count).to eq(1)
        expect(invoice.attachments.first.filename.to_s).to eq("sample.pdf")

        # Use direct params to replace with a new attachment
        params_with_new_attachment = ActionController::Parameters.new({
          **invoice_params,
          **invoice_line_item_params,
          invoice: {
            **invoice_params[:invoice],
            attachment: fixture_file_upload("contract.pdf", "application/pdf"),
          },
        })
        invoice_service_with_new_attachment = described_class.new(
          params: params_with_new_attachment,
          user: user,
          company: company,
          contractor: contractor,
          invoice: invoice
        )

        expect do
          result = invoice_service_with_new_attachment.process
          expect(result[:success]).to eq(true)

          invoice.reload
          expect(invoice.attachments.count).to eq(1)
          # The old attachment should be replaced with the new one
          expect(invoice.attachments.first.filename.to_s).to eq("contract.pdf")
        end.to change { invoice.reload.attachments.count }.by(0)
      end

      it "removes attachment when no attachment is provided" do
        invoice.attachments.purge
        invoice.reload
        expect(invoice.attachments.count).to eq(0)

        # First add an attachment
        invoice.attachments.attach(fixture_file_upload("sample.pdf", "application/pdf"))
        invoice.reload
        expect(invoice.attachments.count).to eq(1)

        # Use direct params instead of invoice_params with no attachment
        params_with_no_attachment = ActionController::Parameters.new({
          **invoice_params,
          **invoice_line_item_params,
        })
        invoice_service_with_no_attachment = described_class.new(
          params: params_with_no_attachment,
          user: user,
          company: company,
          contractor: contractor,
          invoice: invoice
        )

        expect do
          result = invoice_service_with_no_attachment.process
          expect(result[:success]).to eq(true)

          invoice.reload
          expect(invoice.attachments.count).to eq(0)
        end.to change { invoice.reload.attachments.count }.by(-1)
      end

      it "updates the invoice address when the contractor has changed it" do
        user.update!(street_address: "123 2nd Ave", city: "New York", state: "NY", zip_code: "10001")

        params_to_update = ActionController::Parameters.new({
          **invoice_params,
          **invoice_line_item_params,
        })
        invoice_service = described_class.new(
          params: params_to_update,
          user: user,
          company: company,
          contractor: contractor,
          invoice: invoice
        )

        expect do
          result = invoice_service.process
          expect(result[:success]).to be(true)
          expect(invoice.invoice_line_items.length).to eq(2)
          expect(invoice.reload.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
          expect(invoice.invoice_number).to eq("INV-123")
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.notes).to eq("Tax ID: 123efjo32r")
          expect(invoice.street_address).to eq(user.street_address)
          expect(invoice.city).to eq(user.city)
          expect(invoice.state).to eq(user.state)
          expect(invoice.zip_code).to eq(user.zip_code)
          expect(invoice.country_code).to eq(user.country_code)
        end.to_not change { user.invoices.count }
      end

      it "preserves existing attachment when updating with signed_id reference" do
        # First add an attachment to the invoice
        invoice.attachments.purge
        original_attachment = fixture_file_upload("sample.pdf", "application/pdf")
        invoice.attachments.attach(original_attachment)
        invoice.reload
        expect(invoice.attachments.count).to eq(1)
        original_signed_id = invoice.attachments.first.signed_id

        # Update the invoice but reference the existing attachment by signed_id
        params_with_signed_id = ActionController::Parameters.new({
          **invoice_params,
          **invoice_line_item_params,
          invoice: {
            **invoice_params[:invoice],
            attachment: original_signed_id,
          },
        })
        invoice_service_with_signed_id = described_class.new(
          params: params_with_signed_id,
          user: user,
          company: company,
          contractor: contractor,
          invoice: invoice
        )

        expect do
          result = invoice_service_with_signed_id.process
          expect(result[:success]).to eq(true)

          invoice.reload
          expect(invoice.attachments.count).to eq(1)
          # The original attachment should be preserved
          expect(invoice.attachments.first.signed_id).to eq(original_signed_id)
          expect(invoice.attachments.first.filename.to_s).to eq("sample.pdf")
        end.to change { invoice.reload.attachments.count }.by(0)
      end

      it "updates the amounts correctly if the contractor has opted for some compensation in equity" do
        contractor.update!(equity_percentage: 60)

        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(true)
          invoice.reload
          expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
          expect(invoice.equity_percentage).to eq(60)
          expected_equity_cents = (expected_total_amount_in_cents * 0.6).round
          expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
          expected_cash_cents = expected_total_amount_in_cents - expected_equity_cents
          expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
          expect(invoice.flexile_fee_cents).to eq(50 + (1.5 * expected_total_amount_in_cents / 100).round)
          expected_options = 36 # (expected_equity_cents / (company.share_price_in_usd * 100)).round
          expect(invoice.equity_amount_in_options).to eq(expected_options)
        end.to change { user.invoices.count }.by(0)
      end

      it "returns an error message when invoice line item quantity is zero" do
        params[:invoice_line_items] = [{ description: "I worked on XYZ", quantity: 0, pay_rate_in_subunits: 1 }]
        expect do
          result = invoice_service.process
          expect(result[:success]).to eq(false)
          expect(result[:error_message]).to eq(
            "Invoice line items quantity must be greater than or equal to 0.01 and Total amount in usd cents must be greater than 99"
          )
          expect(user.invoices.count).to eq(1)
        end.to_not change { invoice.invoice_line_items.first.quantity }
      end

      include_examples "common invoice failure specs", expected_invoices_count: 0

      context "when line items were removed" do
        before do
          create(:invoice_line_item, invoice:)
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

            expense_1, expense_2 = invoice.invoice_expenses.to_a

            expect(invoice.invoice_line_items.length).to eq(2)
            expect(invoice.invoice_expenses.count).to eq(2)
            expect(invoice.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expected_total_amount = expected_total_amount_in_cents + expense_1.total_amount_in_cents + expense_2.total_amount_in_cents
            expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount)
            expect(invoice.equity_percentage).to eq(0)
            expect(invoice.cash_amount_in_cents).to eq(expected_total_amount)
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
          contractor.update!(equity_percentage: 30)

          expect do
            result = invoice_service.process
            expect(result[:success]).to be(true)
            invoice.reload
            expect(invoice.invoice_expenses.count).to eq(2)
            expense_1, expense_2 = invoice.invoice_expenses.to_a
            expected_total_amount = expected_total_amount_in_cents + expense_1.total_amount_in_cents + expense_2.total_amount_in_cents
            expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount)
            expect(invoice.equity_percentage).to eq(30)
            expected_equity_cents = (expected_total_amount_in_cents * 0.3).round
            expect(invoice.equity_amount_in_cents).to eq(expected_equity_cents)
            expected_cash_cents = expected_total_amount - expected_equity_cents
            expect(invoice.cash_amount_in_cents).to eq(expected_cash_cents)
            expect(invoice.flexile_fee_cents).to eq(15_00) # max fee
            expected_options = 18 # (expected_equity_cents / (company.share_price_in_usd * 100)).round
            expect(invoice.equity_amount_in_options).to eq(expected_options)
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
            expect(invoice.invoice_line_items.length).to eq(2)
            expect(invoice.reload.invoice_date.strftime("%Y-%m-%d")).to eq(Date.current.strftime("%Y-%m-%d"))
            expect(invoice.invoice_number).to eq("INV-123")
            expect(invoice.total_amount_in_usd_cents).to eq(expected_total_amount_in_cents)
            expect(invoice.notes).to eq("Tax ID: 123efjo32r")
            expect(invoice.street_address).to eq(user.street_address)
            expect(invoice.city).to eq(user.city)
            expect(invoice.state).to eq(user.state)
            expect(invoice.zip_code).to eq(user.zip_code)
            expect(invoice.country_code).to eq(user.country_code)
          end.to_not change { user.invoices.count }
        end
      end
    end

    describe "GitHub PR details population" do
      let(:invoice) { nil }
      let(:pr_url) { "https://github.com/acme-org/project/pull/123" }
      let(:pr_details) do
        {
          url: pr_url,
          number: 123,
          title: "Add new feature",
          state: "merged",
          author: "developer",
          repo: "acme-org/project",
          bounty_cents: 50000,
          linked_issue_number: 42,
          linked_issue_repo: "acme-org/project",
        }
      end
      let(:params) do
        ActionController::Parameters.new({
          **invoice_params,
          invoice_line_items: [
            {
              description: pr_url,
              pay_rate_in_subunits: 10000,
              quantity: 1,
              hourly: false,
            }
          ],
        })
      end

      before do
        company.update!(github_org_name: "acme-org")
      end

      it "fetches and stores PR details when description is a valid PR URL from company org" do
        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).to receive(:fetch_pr_details_from_url).with(org_name: "acme-org", url: pr_url).and_return(pr_details)

        result = invoice_service.process
        expect(result[:success]).to be(true)

        line_item = result[:invoice].invoice_line_items.first
        expect(line_item.github_pr_url).to eq(pr_url)
        expect(line_item.github_pr_number).to eq(123)
        expect(line_item.github_pr_title).to eq("Add new feature")
        expect(line_item.github_pr_state).to eq("merged")
        expect(line_item.github_pr_author).to eq("developer")
        expect(line_item.github_pr_repo).to eq("acme-org/project")
        expect(line_item.github_pr_bounty_cents).to eq(50000)
        expect(line_item.github_linked_issue_number).to eq(42)
        expect(line_item.github_linked_issue_repo).to eq("acme-org/project")
      end

      it "does not fetch PR details for non-PR URLs" do
        params[:invoice_line_items][0][:description] = "Regular work description"

        expect(GithubService).to receive(:valid_pr_url?).with("Regular work description").and_return(false)
        expect(GithubService).not_to receive(:fetch_pr_details_from_url)

        result = invoice_service.process
        expect(result[:success]).to be(true)

        line_item = result[:invoice].invoice_line_items.first
        expect(line_item.github_pr_url).to be_nil
      end

      it "does not fetch PR details for PRs from different organizations" do
        params[:invoice_line_items][0][:description] = "https://github.com/other-org/project/pull/456"

        expect(GithubService).to receive(:valid_pr_url?).with("https://github.com/other-org/project/pull/456").and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with("https://github.com/other-org/project/pull/456").and_return({ owner: "other-org", repo: "project", pr_number: 456 })
        expect(GithubService).not_to receive(:fetch_pr_details_from_url)

        result = invoice_service.process
        expect(result[:success]).to be(true)

        line_item = result[:invoice].invoice_line_items.first
        expect(line_item.github_pr_url).to be_nil
      end

      it "does not fetch PR details when company has no GitHub org configured" do
        company.update!(github_org_name: nil)

        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).not_to receive(:fetch_pr_details_from_url)

        result = invoice_service.process
        expect(result[:success]).to be(true)

        line_item = result[:invoice].invoice_line_items.first
        expect(line_item.github_pr_url).to be_nil
      end

      it "clears PR data when description changes from PR URL to regular text" do
        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).to receive(:fetch_pr_details_from_url).with(org_name: "acme-org", url: pr_url).and_return(pr_details)

        result = invoice_service.process
        created_invoice = result[:invoice]
        line_item = created_invoice.invoice_line_items.first
        expect(line_item.github_pr_url).to eq(pr_url)

        # Now update with regular description
        update_params = ActionController::Parameters.new({
          **invoice_params,
          invoice_line_items: [
            {
              id: line_item.id,
              description: "Regular work",
              pay_rate_in_subunits: 10000,
              quantity: 1,
              hourly: false,
            }
          ],
        })

        expect(GithubService).to receive(:valid_pr_url?).with("Regular work").and_return(false)

        update_service = described_class.new(params: update_params, user: user, company: company, contractor: contractor, invoice: created_invoice)
        update_result = update_service.process
        expect(update_result[:success]).to be(true)

        line_item.reload
        expect(line_item.github_pr_url).to be_nil
        expect(line_item.github_pr_number).to be_nil
        expect(line_item.github_pr_title).to be_nil
      end

      it "skips fetching when PR data already exists for the same URL" do
        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).to receive(:fetch_pr_details_from_url).once.and_return(pr_details)

        result = invoice_service.process
        created_invoice = result[:invoice]
        line_item = created_invoice.invoice_line_items.first

        # Update with same PR URL - should skip fetching
        update_params = ActionController::Parameters.new({
          **invoice_params,
          invoice_line_items: [
            {
              id: line_item.id,
              description: pr_url,
              pay_rate_in_subunits: 15000, # different rate
              quantity: 1,
              hourly: false,
            }
          ],
        })

        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).not_to receive(:fetch_pr_details_from_url) # Should not fetch again

        update_service = described_class.new(params: update_params, user: user, company: company, contractor: contractor, invoice: created_invoice)
        update_result = update_service.process
        expect(update_result[:success]).to be(true)
      end

      it "handles GitHub API errors gracefully and clears PR fields" do
        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).to receive(:fetch_pr_details_from_url).and_raise(GithubService::ApiError, "Rate limited")

        result = invoice_service.process
        expect(result[:success]).to be(true)

        line_item = result[:invoice].invoice_line_items.first
        expect(line_item.github_pr_url).to be_nil
        expect(line_item.github_pr_number).to be_nil
      end

      it "handles case-insensitive org name comparison" do
        company.update!(github_org_name: "ACME-ORG")

        expect(GithubService).to receive(:valid_pr_url?).with(pr_url).and_return(true)
        expect(GithubService).to receive(:parse_pr_url).with(pr_url).and_return({ owner: "acme-org", repo: "project", pr_number: 123 })
        expect(GithubService).to receive(:fetch_pr_details_from_url).with(org_name: "ACME-ORG", url: pr_url).and_return(pr_details)

        result = invoice_service.process
        expect(result[:success]).to be(true)
        expect(result[:invoice].invoice_line_items.first.github_pr_url).to eq(pr_url)
      end
    end
  end
end
