# frozen_string_literal: true

RSpec.describe DeleteManyInvoices do
  let(:company) { create(:company) }
  let(:deleted_by) { create(:user) }
  let(:invoice1) { create(:invoice, company: company, status: Invoice::RECEIVED) }
  let(:invoice2) { create(:invoice, company: company, status: Invoice::APPROVED) }
  let(:invoice_ids) { [invoice1.external_id, invoice2.external_id] }

  subject(:service) { described_class.new(company: company, deleted_by: deleted_by, invoice_ids: invoice_ids) }

  describe "#perform" do
    describe "successful deletion" do
      before do
        invoice1 # Create invoices first
        invoice2
        create_list(:invoice_approval, 2, invoice: invoice1)
        create(:invoice_line_item, invoice: invoice1)
        create(:invoice_expense, invoice: invoice1)
      end

      it "soft deletes all specified invoices" do
        expect { service.perform }.to change { Invoice.alive.count }.by(-2)
          .and change { Invoice.deleted.count }.by(2)
      end

      it "calls DeleteInvoice service for each invoice" do
        expect(DeleteInvoice).to receive(:new).with(invoice: invoice1, deleted_by: deleted_by).and_call_original
        expect(DeleteInvoice).to receive(:new).with(invoice: invoice2, deleted_by: deleted_by).and_call_original
        service.perform
      end
    end

    describe "validation" do
      context "when all invoices exist and belong to company" do
        it "proceeds with deletion" do
          invoice1
          invoice2
          expect { service.perform }.to change { Invoice.alive.count }.by(-2)
            .and change { Invoice.deleted.count }.by(2)
        end
      end

      context "when an invoice does not exist" do
        let(:invoice_ids) { [invoice1.external_id, "nonexistent-id"] }

        it "raises ActiveRecord::RecordNotFound" do
          invoice1
          expect { service.perform }.to raise_error(ActiveRecord::RecordNotFound)
        end

        it "does not delete any invoices" do
          invoice1

          expect do
            service.perform
          rescue ActiveRecord::RecordNotFound
            # Expected exception
          end.not_to change { Invoice.alive.count }

          expect do
            service.perform
          rescue ActiveRecord::RecordNotFound
            # Expected exception
          end.not_to change { Invoice.deleted.count }
        end
      end

      context "when invoice belongs to different company" do
        let(:other_company) { create(:company) }
        let(:other_invoice) { create(:invoice, company: other_company) }
        let(:invoice_ids) { [invoice1.external_id, other_invoice.external_id] }

        it "raises ActiveRecord::RecordNotFound" do
          invoice1
          other_invoice
          expect { service.perform }.to raise_error(ActiveRecord::RecordNotFound)
        end
      end
    end

    describe "with mixed invoice statuses" do
      let(:deletable_invoice) { create(:invoice, company: company, status: Invoice::RECEIVED) }
      let(:non_deletable_invoice) { create(:invoice, company: company, status: Invoice::PAID) }
      let(:invoice_ids) { [deletable_invoice.external_id, non_deletable_invoice.external_id] }

      it "attempts to delete all invoices (DeleteInvoice service handles status validation)" do
        expect(DeleteInvoice).to receive(:new).with(invoice: deletable_invoice, deleted_by: deleted_by).and_call_original
        expect(DeleteInvoice).to receive(:new).with(invoice: non_deletable_invoice, deleted_by: deleted_by).and_call_original
        service.perform
      end
    end

    context "with empty invoice_ids array" do
      let(:invoice_ids) { [] }

      it "does not delete any invoices" do
        expect { service.perform }.not_to change { Invoice.alive.count }
        expect { service.perform }.not_to change { Invoice.deleted.count }
      end

      it "does not call DeleteInvoice service" do
        expect(DeleteInvoice).not_to receive(:new)
        service.perform
      end
    end
  end
end
