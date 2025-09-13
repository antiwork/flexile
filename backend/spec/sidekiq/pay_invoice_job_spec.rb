# frozen_string_literal: true

require "rails_helper"

RSpec.describe PayInvoiceJob do
  describe "#perform" do
    let(:invoice_id) { 123 }
    let(:pay_invoice_service) { instance_double(PayInvoice) }
    let(:company) { create(:company) }
    let(:user) { create(:user, company: company) }
    let(:invoice) { create(:invoice, user: user, company: company) }
    let(:job) { described_class.new }

    before do
      allow(PayInvoice).to receive(:new).with(invoice_id).and_return(pay_invoice_service)
      allow(Invoice).to receive(:find).with(invoice_id).and_return(invoice)
    end

    it "processes the invoice payment" do
      expect(pay_invoice_service).to receive(:process)

      job.perform(invoice_id)
    end

    context "when service raises an error" do
      before do
        allow(pay_invoice_service).to receive(:process).and_raise(StandardError.new("API timeout"))
      end

      it "is configured to retry with exponential backoff" do
        expect(described_class.sidekiq_options["retry"]).to eq(3)
        expect(described_class.sidekiq_options["retry_in"]).to be_a(Proc)
      end

      it "calculates correct retry intervals" do
        retry_proc = described_class.sidekiq_options["retry_in"]
        expect(retry_proc.call(1)).to eq(2)  # 2^1 = 2 seconds
        expect(retry_proc.call(2)).to eq(4)  # 2^2 = 4 seconds
        expect(retry_proc.call(3)).to eq(8)  # 2^3 = 8 seconds
      end

      context "during retry attempts" do
        before do
          allow(job).to receive(:bid).and_return({ "retry_count" => 1 })
        end

        it "logs comprehensive audit trail for retry context" do
          allow(user).to receive(:email).and_return("test@example.com")
          allow(user).to receive(:tax_id).and_return("123-45-6789")
          allow(invoice).to receive(:cash_amount_in_cents).and_return(100000)
          allow(invoice).to receive(:cash_amount_in_usd).and_return(1000.0)
          allow(invoice).to receive(:equity_amount_in_options).and_return(50)

          expect(Rails.logger).to receive(:info).with(
            a_string_matching(/PayInvoice AUDIT - Retry Attempt:/)
              .and(matching(/timestamp=/))
              .and(matching(/invoice_id=#{invoice_id}/))
              .and(matching(/retry_count=1/))
              .and(matching(/user_email=test@example\.com/))
              .and(matching(/user_tax_id=123-45-6789/))
              .and(matching(/cash_amount_cents=100000/))
              .and(matching(/cash_amount_usd=1000\.0/))
              .and(matching(/equity_amount=50/))
              .and(matching(/company_name=/))
          )

          expect { job.perform(invoice_id) }.to raise_error(StandardError, "API timeout")
        end

        it "logs comprehensive audit trail for retry failures" do
          allow(pay_invoice_service).to receive(:process).and_raise(StandardError.new("Wise API timeout"))
          allow(user).to receive(:email).and_return("test@example.com")
          allow(user).to receive(:tax_id).and_return("123-45-6789")
          allow(invoice).to receive(:cash_amount_in_cents).and_return(100000)

          expect(Rails.logger).to receive(:info) # retry context log
          expect(Rails.logger).to receive(:error).with(
            a_string_matching(/PayInvoice AUDIT - Retry Failure:/)
              .and(matching(/timestamp=/))
              .and(matching(/invoice_id=#{invoice_id}/))
              .and(matching(/retry_count=1/))
              .and(matching(/user_email=test@example\.com/))
              .and(matching(/user_tax_id=123-45-6789/))
              .and(matching(/cash_amount_cents=100000/))
              .and(matching(/error_class=StandardError/))
              .and(matching(/error_message=Wise API timeout/))
          )

          expect { job.perform(invoice_id) }.to raise_error(StandardError)
        end
      end
    end
  end
end
