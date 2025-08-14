# frozen_string_literal: true

require "spec_helper"

RSpec.describe ApproveInvoice do
  let(:company) { create(:company, equity_enabled: true, fmv_per_share_in_usd: 1.0, conversion_share_price_usd: 1.0) }
  let(:company_worker) { create(:company_worker, company:, equity_percentage: 50) }
  let(:invoice) { create(:invoice, company:, company_worker:, user: company_worker.user) }
  let(:approver) { create(:company_administrator, company:).user }
  let(:service) { described_class.new(invoice:, approver:) }

  before do
    # Ensure there's a company administrator for grant creation
    create(:company_administrator, company:)
  end

  describe "#perform" do
    context "when equity is enabled and contractor has equity percentage" do
      context "and no equity grant exists" do
        it "raises error requiring admin to create grant" do
          expect do
            service.perform
          end.to raise_error(ActiveRecord::RecordInvalid, /Admin must create an equity grant/)

          expect(invoice.reload.status).to eq(Invoice::RECEIVED)
          expect(invoice.invoice_approvals_count).to eq(0)
        end
      end

      context "and equity grant has insufficient shares" do
        before do
          company_worker.user.company_investors.create!(company:, investment_amount_in_cents: 0)
          option_pool = create(:option_pool, company:)

          # Create grant with insufficient shares
          GrantStockOptions.new(
            company_worker,
            option_pool:,
            board_approval_date: Date.current,
            vesting_commencement_date: Date.current,
            number_of_shares: 10,
            issue_date_relationship: "consultant",
            option_grant_type: "nso",
            option_expiry_months: 120,
            vesting_trigger: "invoice_paid",
            vesting_schedule_params: nil,
            voluntary_termination_exercise_months: 12,
            involuntary_termination_exercise_months: 3,
            termination_with_cause_exercise_months: 0,
            death_exercise_months: 12,
            disability_exercise_months: 12,
            retirement_exercise_months: 12
          ).process
        end

        it "raises error requiring admin to create sufficient grant" do
          expect do
            service.perform
          end.to raise_error(ActiveRecord::RecordInvalid, /Admin must create an equity grant/)

          expect(invoice.reload.status).to eq(Invoice::RECEIVED)
          expect(invoice.invoice_approvals_count).to eq(0)
        end
      end

      context "and sufficient equity grant exists" do
        before do
          # Create a grant with sufficient shares
          company_worker.user.company_investors.create!(company:, investment_amount_in_cents: 0)
          option_pool = create(:option_pool, company:, authorized_shares: 20_000, issued_shares: 0)

          GrantStockOptions.new(
            company_worker,
            option_pool:,
            board_approval_date: Date.current,
            vesting_commencement_date: Date.current,
            number_of_shares: 10000, # Large number to ensure it's sufficient
            issue_date_relationship: "consultant",
            option_grant_type: "nso",
            option_expiry_months: 120,
            vesting_trigger: "invoice_paid",
            vesting_schedule_params: nil,
            voluntary_termination_exercise_months: 12,
            involuntary_termination_exercise_months: 3,
            termination_with_cause_exercise_months: 0,
            death_exercise_months: 12,
            disability_exercise_months: 12,
            retirement_exercise_months: 12
          ).process
        end

        it "successfully approves the invoice" do
          expect do
            service.perform
          end.not_to raise_error

          expect(invoice.reload.status).to eq(Invoice::APPROVED)
          expect(invoice.invoice_approvals_count).to eq(1)
        end
      end
    end

    context "when contractor has zero equity percentage" do
      before do
        company_worker.update!(equity_percentage: 0)
      end

      it "approves invoice without requiring equity grant" do
        expect do
          service.perform
        end.not_to raise_error

        expect(invoice.reload.status).to eq(Invoice::APPROVED)
        expect(invoice.invoice_approvals_count).to eq(1)
      end
    end

    context "when equity is disabled" do
      before do
        company.update!(equity_enabled: false)
      end

      it "approves invoice without requiring equity grant" do
        expect do
          service.perform
        end.not_to raise_error

        expect(invoice.reload.status).to eq(Invoice::APPROVED)
        expect(invoice.invoice_approvals_count).to eq(1)
      end
    end
  end
end
