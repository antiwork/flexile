# frozen_string_literal: true

RSpec.describe Github::PrPaymentLookupService do
  let(:company) { create(:company) }
  let(:service) { described_class.new(company: company) }
  let(:pr_url) { "https://github.com/antiwork/flexile/pull/242" }

  describe "#pr_previously_paid?" do
    context "when no invoices exist with the PR" do
      it "returns false" do
        expect(service.pr_previously_paid?(pr_url)).to be false
      end
    end

    context "when PR is blank" do
      it "returns false" do
        expect(service.pr_previously_paid?(nil)).to be false
        expect(service.pr_previously_paid?("")).to be false
      end
    end

    context "when a paid invoice exists with the PR" do
      let(:user) { create(:user) }
      let(:company_worker) { create(:company_worker, company: company, user: user) }
      let!(:paid_invoice) do
        create(:invoice, :paid, company: company, user: user, company_contractor_id: company_worker.id)
      end
      let!(:line_item) do
        create(:invoice_line_item, invoice: paid_invoice, github_pr_url: pr_url)
      end

      it "returns true" do
        expect(service.pr_previously_paid?(pr_url)).to be true
      end

      it "returns false when excluding the matching invoice" do
        expect(service.pr_previously_paid?(pr_url, exclude_invoice_id: paid_invoice.id)).to be false
      end
    end

    context "when only unpaid invoices exist with the PR" do
      let(:user) { create(:user) }
      let(:company_worker) { create(:company_worker, company: company, user: user) }
      let!(:unpaid_invoice) do
        create(:invoice, company: company, user: user, company_contractor_id: company_worker.id)
      end
      let!(:line_item) do
        create(:invoice_line_item, invoice: unpaid_invoice, github_pr_url: pr_url)
      end

      it "returns false" do
        expect(service.pr_previously_paid?(pr_url)).to be false
      end
    end

    context "when PR is paid by another company" do
      let(:other_company) { create(:company) }
      let(:user) { create(:user) }
      let(:company_worker) { create(:company_worker, company: other_company, user: user) }
      let!(:paid_invoice) do
        create(:invoice, :paid, company: other_company, user: user, company_contractor_id: company_worker.id)
      end
      let!(:line_item) do
        create(:invoice_line_item, invoice: paid_invoice, github_pr_url: pr_url)
      end

      it "returns false (scoped to company)" do
        expect(service.pr_previously_paid?(pr_url)).to be false
      end
    end
  end

  describe "#find_paid_invoices_for_pr" do
    context "when no invoices exist" do
      it "returns empty array" do
        expect(service.find_paid_invoices_for_pr(pr_url)).to eq([])
      end
    end

    context "when paid invoices exist" do
      let(:user) { create(:user, legal_name: "John Doe") }
      let(:company_worker) { create(:company_worker, company: company, user: user) }
      let!(:paid_invoice) do
        create(:invoice, :paid, company: company, user: user, company_contractor_id: company_worker.id)
      end
      let!(:line_item) do
        create(:invoice_line_item, invoice: paid_invoice, github_pr_url: pr_url)
      end

      it "returns invoice details" do
        result = service.find_paid_invoices_for_pr(pr_url)

        expect(result.length).to eq(1)
        expect(result[0][:invoice_id]).to eq(paid_invoice.id)
        expect(result[0][:invoice_number]).to eq(paid_invoice.invoice_number)
        expect(result[0][:contractor_name]).to eq("John Doe")
      end
    end
  end

  describe "#find_all_invoices_for_pr" do
    let(:user) { create(:user) }
    let(:company_worker) { create(:company_worker, company: company, user: user) }

    context "when multiple invoices exist for the same PR" do
      let!(:paid_invoice) do
        create(:invoice, :paid, company: company, user: user, company_contractor_id: company_worker.id)
      end
      let!(:paid_line_item) do
        create(:invoice_line_item, invoice: paid_invoice, github_pr_url: pr_url)
      end

      let!(:pending_invoice) do
        create(:invoice, company: company, user: user, company_contractor_id: company_worker.id)
      end
      let!(:pending_line_item) do
        create(:invoice_line_item, invoice: pending_invoice, github_pr_url: pr_url)
      end

      it "returns all invoices with is_paid flag" do
        result = service.find_all_invoices_for_pr(pr_url)

        expect(result.length).to eq(2)
        paid_result = result.find { |r| r[:invoice_id] == paid_invoice.id }
        pending_result = result.find { |r| r[:invoice_id] == pending_invoice.id }

        expect(paid_result[:is_paid]).to be true
        expect(pending_result[:is_paid]).to be false
      end
    end
  end
end
