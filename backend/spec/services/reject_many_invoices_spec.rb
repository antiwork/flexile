# frozen_string_literal: true

RSpec.describe RejectManyInvoices do
  let(:company) { create(:company) }
  let(:rejected_by) { create(:user) }
  let(:reason) { "Invalid invoice" }
  let(:invoices) { create_list(:invoice, 3, company:) }
  let(:invoice_ids) { invoices.map(&:external_id) }

  subject { described_class.new(company:, rejected_by:, invoice_ids:, reason:) }

  describe "#perform" do
    it "calls RejectInvoice for each invoice" do
      invoices.each do |invoice|
        expect(RejectInvoice).to receive(:new).with(invoice:, rejected_by:, reason:).and_call_original
      end
      subject.perform
    end

    context "without a reason" do
      let(:reason) { nil }

      it "allows rejecting invoices" do
        invoices.each do |invoice|
          expect(RejectInvoice).to receive(:new).with(invoice:, rejected_by:, reason:).and_call_original
        end
        subject.perform
      end
    end

    context "when an invoice doesn't belong to the company" do
      let(:invoice_ids) { invoices.map(&:external_id) + [create(:invoice).id] }

      it "raises an ActiveRecord::RecordNotFound error" do
        expect(RejectInvoice).not_to receive(:new)
        expect { subject.perform }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when an invoice ID is invalid" do
      let(:invoice_ids) { invoices.map(&:external_id) + ["non_existent_id"] }

      it "raises an ActiveRecord::RecordNotFound error" do
        expect(RejectInvoice).not_to receive(:new)
        expect { subject.perform }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
