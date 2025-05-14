# frozen_string_literal: true

RSpec.describe "Invoice details page" do
  include InvoiceHelpers

  let(:company) { create(:company) }
  let(:admin_user) { create(:company_administrator, company:).user }
  let(:contractor_user) { create(:company_worker, company:).user }

  shared_examples_for "status details" do
    context "for an approved invoice", :freeze_time do
      let(:invoice) { create(:invoice, company:, user: contractor_user) }

      before do
        admin_user_1 = create(:user, :company_admin, preferred_name: "Sahil")
        admin_user_2 = create(:user, :company_admin, preferred_name: "Steven")
        [admin_user_1, admin_user_2].each do |admin_user|
          ApproveInvoice.new(invoice:, approver: admin_user).perform
        end
      end

      it "shows the status in the header and lists the approvals in a callout" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        within "main > header" do
          expect(page).to have_selector("[aria-label='Status']", text: human_status(invoice))
        end

        within "[role='status']" do
          expect(page).to have_text("Approved by Sahil on #{Time.current.strftime("%b %-d, %Y, %-I:%M %p")}")
          expect(page).to have_text("Approved by Steven on #{Time.current.strftime("%b %-d, %Y, %-I:%M %p")}")
        end
      end
    end

    context "for a partially approved invoice", :freeze_time do
      let(:invoice) { create(:invoice, company:, user: contractor_user) }

      before do
        admin_user = create(:user, :company_admin, preferred_name: "Sahil")
        ApproveInvoice.new(invoice:, approver: admin_user).perform
      end

      it "shows the status in the header and lists the approvals in a callout" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        within "main > header" do
          expect(page).to have_selector("[aria-label='Status']", text: human_status(invoice))
        end

        within "[role='status']" do
          expect(page).to have_text("Approved by Sahil on #{Time.current.strftime("%b %-d, %Y, %-I:%M %p")}")
        end
      end
    end

    context "for a pending payment invoice" do
      let(:invoice) { create(:invoice, :payment_pending, company:, user: contractor_user) }

      it "shows the status in the header and the expected payment date in a callout" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        within "main > header" do
          expect(page).to have_selector("[aria-label='Status']", text: human_status(invoice))
        end

        within "[role='status']" do
          expect(page).to have_text("Your payment should arrive by #{invoice.payment_expected_by.strftime("%b %-d, %Y")}")
        end
      end
    end

    context "for a processing invoice" do
      let(:invoice) { create(:invoice, :processing, company:, user: contractor_user) }

      it "shows the status in the header and expected payment date in a callout" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        within "main > header" do
          expect(page).to have_selector("[aria-label='Status']", text: human_status(invoice))
        end

        within "[role='status']" do
          expect(page).to have_text("Your payment should arrive by #{invoice.payment_expected_by.strftime("%b %-d, %Y")}")
        end
      end
    end

    context "for a rejected invoice" do
      let(:invoice) do
        create(:invoice, :rejected, company:, user: contractor_user,
                                    rejection_reason: "Duplicate invoice", rejected_at: Date.parse("Jul 9, 2024"))
      end

      it "shows the status in the header and rejection details in a callout" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        within "main > header" do
          expect(page).to have_selector("[aria-label='Status']", text: human_status(invoice))
        end

        within "[role='status']" do
          expect(page).to have_text("Rejected by #{invoice.rejected_by.display_name} on Jul 9, 2024: \"Duplicate invoice\"")
        end
      end
    end
  end

  context "when logged in as a company worker" do
    before { sign_in contractor_user }

    it_behaves_like "status details"

    context "editing invoices" do
      it "allows editing a submitted invoice" do
        invoice = create(:invoice, user: contractor_user)

        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        click_on "Edit invoice"
        fill_in "Description", with: "Writing code"
        click_on "Re-submit"
        wait_for_ajax
        expect(invoice.invoice_line_items.first.reload.description).to eq "Writing code"
      end

      it "allows editing a rejected invoice" do
        invoice = create(:invoice, :rejected, user: contractor_user)

        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        click_on "Submit again"
        fill_in "Description", with: "Writing code"
        click_on "Re-submit"
        wait_for_ajax
        expect(invoice.invoice_line_items.first.reload.description).to eq "Writing code"
      end

      it "does not allow editing a paid invoice" do
        invoice = create(:invoice, :paid, user: contractor_user)

        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        expect(page).not_to have_button "Edit invoice"
      end
    end
  end

  context "when logged in as a company admin" do
    before { sign_in admin_user }

    it_behaves_like "status details"

    it "allows approving an invoice" do
      invoice = create(:invoice, company:, user: contractor_user)

      visit spa_company_invoice_path(company.external_id, invoice.external_id)

      expect do
        click_on "Approve"
        wait_for_ajax
      end.to change { invoice.reload.status }.from(Invoice::RECEIVED).to(Invoice::APPROVED)

      select_tab "Approved"
      expect(page).to have_link(href: spa_company_invoice_path(company.external_id, invoice.external_id))
      expect(find_button("Awaiting approval (1/2)")).to have_tooltip "Approved by you on #{Time.current.strftime("%b %-d")}"
    end

    describe "paying an invoice" do
      let(:invoice) { create(:invoice, :fully_approved, company:, user: contractor_user) }

      it "allows paying an invoice" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        expect do
          click_on "Pay now"
          wait_for_ajax

          consolidated_invoice = company.consolidated_invoices.last
          expect(ChargeConsolidatedInvoiceJob).to have_enqueued_sidekiq_job(consolidated_invoice.id)
        end.to change { InvoiceApproval.count }.by(1)
          .and change { company.consolidated_invoices.count }.by(1)
      end

      it "does not allow paying an invoice if the company has not completed payment method setup" do
        allow_any_instance_of(Company).to receive(:bank_account_ready?).and_return(false)

        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        expect(page).to have_button("Pay now", disabled: true)
      end

      context "when the contractor has not provided tax information" do
        before { company.update!(irs_tax_forms: true) }

        it "does not allow paying an invoice if the contractor has not provided tax information" do
          visit spa_company_invoice_path(company.external_id, invoice.external_id)

          expect(page).to have_text("Missing tax information")
          expect(page).to have_button("Pay now", disabled: true)
        end
      end
    end

    describe "rejecting an invoice" do
      let(:invoice) { create(:invoice, company:, user: contractor_user) }

      it "allows rejecting an invoice without a reason" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        click_on "Reject"
        expect do
          click_on "Yes, reject"
          wait_for_ajax
        end.to have_enqueued_mail(CompanyWorkerMailer, :invoice_rejected)
                .with(invoice_id: invoice.id, reason: nil)

        select_tab "Rejected"
        expect(page).to have_text("Rejected")
        expect(page).to have_link(href: spa_company_invoice_path(company.external_id, invoice.external_id))
      end

      it "allows rejecting an invoice with a reason" do
        visit spa_company_invoice_path(company.external_id, invoice.external_id)

        click_on "Reject"
        fill_in "Explain why the invoice was rejected and how to fix it (optional)",
                with: "Invoice issue date mismatch"
        expect do
          click_on "Yes, reject"
          wait_for_ajax
        end.to have_enqueued_mail(CompanyWorkerMailer, :invoice_rejected)
                .with(invoice_id: invoice.id, reason: "Invoice issue date mismatch")

        select_tab "Rejected"
        expect(page).to have_text("Rejected")
        expect(page).to have_link(href: spa_company_invoice_path(company.external_id, invoice.external_id))
      end
    end
  end
end
