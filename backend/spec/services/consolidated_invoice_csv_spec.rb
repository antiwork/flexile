# frozen_string_literal: true

RSpec.describe ConsolidatedInvoiceCsv do
  describe "#generate" do
    it "includes data for consolidated invoices and their payments and invoices" do
      ci_1 = create(:consolidated_invoice,
                    invoice_date: Date.new(2023, 10, 1),
                    invoice_amount_cents: 700_00,
                    flexile_fee_cents: 45_00,
                    transfer_fee_cents: 1_25,
                    invoices: [
                      create(:invoice, status: Invoice::RECEIVED, total_amount_in_usd_cents: 300_00),
                      create(:invoice, status: Invoice::APPROVED, total_amount_in_usd_cents: 400_00),
                    ])

      ci_2_paid_invoice = create(:invoice, status: Invoice::PAID, total_amount_in_usd_cents: 100_00, cash_amount_in_cents: 80_00, equity_amount_in_cents: 20_00)
      create(:payment, invoice: ci_2_paid_invoice, status: Payment::SUCCEEDED, wise_transfer_id: "abc123", wise_recipient: create(:wise_recipient, account_holder_name: "Jon Contractor", recipient_id: "1234567"))
      create(:payment, invoice: ci_2_paid_invoice, status: Payment::FAILED, wise_recipient: create(:wise_recipient, account_holder_name: "Jonathan Q Contractor", recipient_id: "8888888"))

      ci_2_failed_invoice = create(:invoice, status: Invoice::FAILED, total_amount_in_usd_cents: 200_00)
      create(:payment, invoice: ci_2_failed_invoice, status: Payment::FAILED, wise_transfer_id: "xyz456", wise_recipient: ci_2_failed_invoice.user.bank_account)

      ci_2 = create(:consolidated_invoice,
                    invoice_date: Date.new(2023, 8, 1),
                    created_at: DateTime.new(2023, 8, 1),
                    status: Invoice::PAID,
                    invoice_amount_cents: 300_00,
                    flexile_fee_cents: 30_00,
                    transfer_fee_cents: 75,
                    invoices: [ci_2_paid_invoice, ci_2_failed_invoice])
      create(:consolidated_payment, status: Payment::FAILED, consolidated_invoice: ci_2, stripe_payment_intent_id: "000000")
      create(:consolidated_payment, status: Payment::SUCCEEDED, consolidated_invoice: ci_2, stripe_payment_intent_id: "111111", succeeded_at: DateTime.new(2023, 8, 10), stripe_fee_cents: 90)

      consolidated_invoices = [ci_1, ci_2]
      csv = described_class.new(consolidated_invoices).generate
      parsed_csv = CSV.parse(csv)
      expect(parsed_csv).to match_array [
        ConsolidatedInvoiceCsv::HEADERS,
        ["10/1/2023", "", ci_1.id.to_s, ci_1.company.name, "700.0", "45.0", "1.25", "746.25", "", "sent", "",
         ci_1.invoices.first.user.legal_name, "", "",
         ci_1.invoices.first.id.to_s, "", "300.0", "0.0", "300.0", "open"],
        ["10/1/2023", "", ci_1.id.to_s, ci_1.company.name, "700.0", "45.0", "1.25", "746.25", "", "sent", "",
         ci_1.invoices.second.user.legal_name, "", "",
         ci_1.invoices.second.id.to_s, "", "400.0", "0.0", "400.0", "approved"],
        ["8/1/2023", "8/10/2023", ci_2.id.to_s, ci_2.company.name, "300.0", "30.0", "0.75", "330.75", "0.9", "paid", "000000;111111",
         ci_2_paid_invoice.user.legal_name, "Jon Contractor;Jonathan Q Contractor", "1234567;8888888",
         ci_2_paid_invoice.id.to_s, "abc123", "80.0", "20.0", "100.0", "paid"],
        ["8/1/2023", "8/10/2023", ci_2.id.to_s, ci_2.company.name, "300.0", "30.0", "0.75", "330.75", "0.9", "paid", "000000;111111",
         ci_2_failed_invoice.user.legal_name, ci_2_failed_invoice.user.bank_account.account_holder_name, ci_2_failed_invoice.user.bank_account.recipient_id,
         ci_2_failed_invoice.id.to_s, "xyz456", "200.0", "0.0", "200.0", "failed"],
      ]
    end
  end
end
