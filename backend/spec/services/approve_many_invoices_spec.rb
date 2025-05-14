# frozen_string_literal: true

RSpec.describe ApproveManyInvoices do
  let(:company) { create(:company) }
  let(:approver) { create(:company_administrator, company:).user }
  let(:invoices) { create_list(:invoice, 3, company:) }
  let(:invoice_ids) { invoices.map(&:external_id) }

  subject(:service) { described_class.new(company:, approver:, invoice_ids:) }

  describe "#perform" do
    it "calls ApproveInvoice for each invoice" do
      invoices.each do |invoice|
        expect(ApproveInvoice).to receive(:new).with(invoice:, approver:).and_call_original
      end

      service.perform
    end

    context "when an invoice doesn't belong to the company" do
      let(:invoice_ids) { invoices.map(&:external_id) + [create(:invoice).id] }

      it "raises an ActiveRecord::RecordNotFound error" do
        expect(ApproveInvoice).not_to receive(:new)
        expect { subject.perform }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when an invoice ID is invalid" do
      let(:invoice_ids) { invoices.map(&:external_id) + ["non_existent_id"] }

      it "raises an ActiveRecord::RecordNotFound error" do
        expect(ApproveInvoice).not_to receive(:new)
        expect { subject.perform }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
