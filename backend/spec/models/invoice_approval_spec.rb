# frozen_string_literal: true

RSpec.describe InvoiceApproval do
  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to belong_to(:approver) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:invoice) }
    it { is_expected.to validate_presence_of(:approver) }

    context "when another approval exists" do
      before do
        create(:invoice_approval)
      end

      it { is_expected.to validate_uniqueness_of(:invoice_id).scoped_to(:approver_id) }
    end

    context "when approver is a contractor" do
      let(:contractor) { create(:user, :contractor) }
      let(:invoice_approval) { build(:invoice_approval, approver: contractor) }

      it "is invalid" do
        expect(invoice_approval).to be_invalid
        expect(invoice_approval.errors.full_messages).to eq(["Only company administrators can approve invoices."])
      end
    end

    context "when approver is a company administrator for another company" do
      let(:company_administrator) { create(:user, :company_admin) }
      let(:invoice_approval) { build(:invoice_approval, approver: company_administrator) }

      it "is invalid" do
        expect(invoice_approval).to be_invalid
        expect(invoice_approval.errors.full_messages).to eq(["Only company administrators can approve invoices."])
      end
    end

    context "when approver is a company administrator for the invoice company" do
      let(:invoice) { create(:invoice) }
      let(:company_administrator) { create(:company_administrator, company: invoice.company).user }
      let(:invoice_approval) { build(:invoice_approval, invoice:, approver: company_administrator) }

      it "is valid" do
        expect(invoice_approval).to be_valid
      end
    end
  end

  describe "#set_approved_timestamp" do
    it "auto-populates approved_at" do
      invoice_approval = create(:invoice_approval)

      expect(invoice_approval.approved_at).to be_present
    end
  end
end
