# frozen_string_literal: true

RSpec.describe InvoiceEquityCalculator do
  let(:company_worker) { create(:company_worker, company:, equity_percentage: 60) }
  let(:investor) { create(:company_investor, company:, user: company_worker.user) }
  let(:company) { create(:company) }
  let(:service_amount_cents) { 720_37 }
  let(:invoice_year) { Date.current.year }
  let(:share_price_usd) { 2.34 }
  let!(:equity_grant) do
    create(:active_grant, company_investor: investor, share_price_usd:, year: Date.current.year)
  end

  subject(:calculator) { described_class.new(company_worker:, company:, service_amount_cents:, invoice_year:) }

  context "when equity compensation is enabled" do
    before do
      company.update!(equity_enabled: true)
    end

    context "and company_worker has equity percentage" do
      it "calculates equity amount in cents and options correctly" do
        result = calculator.calculate
        expect(result[:equity_cents]).to eq(432_22) # (60% of $720.37).round
        expect(result[:equity_options]).to eq(185) # ($432.22/ $2.34).round
        expect(result[:equity_percentage]).to eq(60)
      end
    end

    context "and computed equity component is too low to make up a whole share" do
      let(:share_price_usd) { 14.90 }

      it "returns zero for all equity values when calculation results in zero shares" do
        company_worker.update!(equity_percentage: 1)
        result = calculator.calculate

        # Equity portion = $720 * 1% = $7.20
        # Shares = $7.20 / $14.9 = 0.4832214765100671 = 0 (rounded)
        # Since this results in 0 shares (not insufficient grant), set equity to zero
        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
      end
    end

    context "but company_worker does not have equity percentage" do
      it "returns zero equity values" do
        company_worker.update!(equity_percentage: 0)
        result = calculator.calculate
        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
      end
    end

    context "and computed equity component exceeds available unvested shares" do
      before do
        # Reduce unvested shares to just 1, moving them to vested (700 -> 1, 100 -> 799)
        # Total remains 1000: 799 vested + 1 unvested + 200 exercised + 0 forfeited = 1000
        equity_grant.update!(unvested_shares: 1, vested_shares: 799)
      end

      it "returns nil to indicate grant creation required" do
        result = calculator.calculate
        expect(result).to be_nil
      end
    end

    context "and an eligible unvested equity grant for the year is absent" do
      let(:invoice_year) { Date.current.year + 2 }

      it "returns nil to indicate grant creation required" do
        result = calculator.calculate
        expect(result).to be_nil
      end

      context "and the company does not have a share price" do
        before do
          company.update!(fmv_per_share_in_usd: nil)
        end

        it "notifies about the missing share price and returns nil" do
          message = "InvoiceEquityCalculator: Error determining share price for CompanyWorker #{company_worker.id}"
          expect(Bugsnag).to receive(:notify).with(message)

          expect(calculator.calculate).to be_nil
        end
      end
    end
  end

  context "when equity compensation is not enabled" do
    it "returns zero equity values" do
      result = calculator.calculate
      expect(result[:equity_cents]).to eq(0)
      expect(result[:equity_options]).to eq(0)
      expect(result[:equity_percentage]).to eq(0)
    end
  end

  # Test for GitHub issue #882: Ensure equity splits are not wiped when submitted
  context "when equity grants are missing or insufficient" do
    context "when no equity grant exists" do
      let(:company_worker_no_grant) { create(:company_worker, company:, equity_percentage: 50) }
      let(:calculator_no_grant) do
        described_class.new(
          company_worker: company_worker_no_grant,
          company: company,
          service_amount_cents: service_amount_cents,
          invoice_year: invoice_year
        )
      end

      it "returns nil instead of wiping equity split" do
        result = calculator_no_grant.calculate

        expect(result).to be_nil
        # Verify the equity percentage is preserved on the company_worker
        expect(company_worker_no_grant.reload.equity_percentage).to eq(50)
      end
    end

    context "when equity grant has insufficient shares" do
      let(:company_worker_insufficient) { create(:company_worker, company:, equity_percentage: 50) }
      let(:option_pool) { create(:option_pool, company:) }
      let!(:insufficient_grant) do
        GrantStockOptions.new(
          company_worker_insufficient,
          option_pool:,
          board_approval_date: Date.current,
          vesting_commencement_date: Date.current,
          number_of_shares: 1, # Insufficient for 50% equity
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
      let(:calculator_insufficient) do
        described_class.new(
          company_worker: company_worker_insufficient,
          company: company,
          service_amount_cents: 100000, # Large amount to require more shares
          invoice_year: invoice_year
        )
      end

      it "returns nil instead of wiping equity split" do
        result = calculator_insufficient.calculate

        expect(result).to be_nil
        # Verify the equity percentage is preserved on the company_worker
        expect(company_worker_insufficient.reload.equity_percentage).to eq(50)
      end
    end

    context "when contractor has zero equity percentage" do
      let(:company_worker_zero) { create(:company_worker, company:, equity_percentage: 0) }
      let(:calculator_zero) do
        described_class.new(
          company_worker: company_worker_zero,
          company: company,
          service_amount_cents: service_amount_cents,
          invoice_year: invoice_year
        )
      end

      it "returns valid result without requiring equity grant" do
        result = calculator_zero.calculate

        expect(result).not_to be_nil
        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
      end
    end
  end
end
