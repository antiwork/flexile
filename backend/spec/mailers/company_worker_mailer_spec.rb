# frozen_string_literal: true

RSpec.describe CompanyWorkerMailer do
  describe "payment_failed_generic" do
    let(:company) { create(:company) }
    let(:user) { create(:user) }
    let(:invoice) { create(:invoice, user:, company:, total_amount_in_usd_cents: 200_00, invoice_number: "INV-001") }
    let(:payment) { create(:payment, invoice:) }
    let(:amount) { 200.00 }
    let(:currency) { "USD" }
    let(:mail) { described_class.payment_failed_generic(payment.id, amount, currency) }

    it "renders the headers" do
      expect(mail.subject).to eq("🔴 Payment failed: Payment Failure for Invoice ##{invoice.id}")
      expect(mail.to).to eq([user.email])
      default_from_email = Mail::Address.new(described_class.default[:from]).address
      expect(mail.from).to eq([default_from_email])
      expect(mail.cc).to eq(["support@flexile.com"])
    end

    it "renders the body with correct details" do
      body = mail.body.encoded
      expect(body).to include("There was an issue processing your payment of 200 USD")
      expect(body).to include("Invoice ID")
      expect(body).to include("INV-001")
      expect(body).to include("Invoice amount")
      expect(body).to include("200 USD")
      expect(body).to include("Payment failed")
      expect(body).to include("Our team has been notified and is currently investigating the issue.")
    end
  end
end
