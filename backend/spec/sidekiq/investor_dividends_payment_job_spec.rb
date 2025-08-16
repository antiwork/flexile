# frozen_string_literal: true

RSpec.describe InvestorDividendsPaymentJob do
  let(:company) { create(:company, equity_enabled: true) }
  let(:user) { create(:user, :without_compliance_info) }
  let!(:user_compliance_info) do
    create(:user_compliance_info,
           user: user,
           tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED,
           tax_information_confirmed_at: 1.day.ago)
  end
  let(:company_investor) { create(:company_investor, user: user, company: company) }
  let(:dividend_round) { create(:dividend_round, company: company, release_document: nil) }

  let!(:dividend1) do
    create(:dividend,
           company_investor: company_investor,
           dividend_round: dividend_round,
           status: Dividend::ISSUED,
           total_amount_in_cents: 100_000,
           net_amount_in_cents: nil,
           withheld_tax_cents: nil,
           withholding_percentage: nil,
           user_compliance_info_id: nil)
  end

  let!(:dividend2) do
    create(:dividend,
           company_investor: company_investor,
           dividend_round: dividend_round,
           status: Dividend::RETAINED,
           total_amount_in_cents: 50_000,
           net_amount_in_cents: nil,
           withheld_tax_cents: nil,
           withholding_percentage: nil,
           user_compliance_info_id: nil)
  end

  # Mock PayInvestorDividends service
  let(:mock_pay_service) { instance_double(PayInvestorDividends) }

  # Mock DividendTaxWithholdingCalculator
  let(:mock_tax_calculator) { instance_double(DividendTaxWithholdingCalculator) }

  before do
    allow(PayInvestorDividends).to receive(:new).and_return(mock_pay_service)
    allow(mock_pay_service).to receive(:process)

    allow(DividendTaxWithholdingCalculator).to receive(:new).and_return(mock_tax_calculator)
    allow(mock_tax_calculator).to receive(:net_cents).and_return(85_000)
    allow(mock_tax_calculator).to receive(:cents_to_withhold).and_return(15_000)
    allow(mock_tax_calculator).to receive(:withholding_percentage).and_return(15.0)
  end

  describe "#perform" do
    context "when user has not verified tax ID" do
      before { user_compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID) }

      it "returns early without processing dividends" do
        described_class.new.perform(company_investor.id)

        expect(PayInvestorDividends).not_to have_received(:new)
        expect(mock_pay_service).not_to have_received(:process)
      end
    end

    context "when user has not confirmed tax information" do
      before { user_compliance_info.update!(tax_information_confirmed_at: nil) }

      it "returns early without processing dividends" do
        described_class.new.perform(company_investor.id)

        expect(PayInvestorDividends).not_to have_received(:new)
        expect(mock_pay_service).not_to have_received(:process)
      end
    end

    context "when user is eligible for dividend payment" do
      it "processes all eligible dividends when no specific dividend ID is provided" do
        described_class.new.perform(company_investor.id)

        expect(PayInvestorDividends).to have_received(:new).with(
          company_investor,
          match_array([dividend1, dividend2])
        )
        expect(mock_pay_service).to have_received(:process)
      end

      it "processes only specific dividend when dividend ID is provided" do
        described_class.new.perform(company_investor.id, dividend1.id)

        expect(PayInvestorDividends).to have_received(:new) do |investor, dividends|
          expect(investor).to eq(company_investor)
          expect(dividends.to_a).to eq([dividend1])
        end
        expect(mock_pay_service).to have_received(:process)
      end

      it "updates dividend tax information before processing payment" do
        described_class.new.perform(company_investor.id)

        dividend1.reload
        dividend2.reload

        expect(dividend1.net_amount_in_cents).to eq(85_000)
        expect(dividend1.withheld_tax_cents).to eq(15_000)
        expect(dividend1.withholding_percentage).to eq(15.0)
        expect(dividend1.user_compliance_info_id).to eq(user_compliance_info.id)

        expect(dividend2.net_amount_in_cents).to eq(85_000)
        expect(dividend2.withheld_tax_cents).to eq(15_000)
        expect(dividend2.withholding_percentage).to eq(15.0)
        expect(dividend2.user_compliance_info_id).to eq(user_compliance_info.id)
      end

      it "skips tax calculation if dividend already has tax information" do
        dividend1.update!(
          net_amount_in_cents: 90_000,
          withheld_tax_cents: 10_000,
          withholding_percentage: 10.0
        )

        described_class.new.perform(company_investor.id)

        dividend1.reload
        expect(dividend1.net_amount_in_cents).to eq(90_000) # Unchanged
        expect(dividend1.withheld_tax_cents).to eq(10_000) # Unchanged
        expect(dividend1.withholding_percentage).to eq(10.0) # Unchanged
      end

      it "creates tax calculator with correct parameters" do
        described_class.new.perform(company_investor.id)

        expect(DividendTaxWithholdingCalculator).to have_received(:new).with(
          company_investor,
          tax_year: dividend1.created_at.year,
          dividends: [dividend1]
        ).twice # Once for each dividend
      end
    end

    context "with dividend round requiring signed release" do
      let(:dividend_round_with_release) do
        create(:dividend_round, company: company, release_document: "some_document")
      end

      let!(:dividend_with_release) do
        create(:dividend,
               company_investor: company_investor,
               dividend_round: dividend_round_with_release,
               status: Dividend::ISSUED,
               signed_release_at: Time.current)
      end

      let!(:dividend_without_release) do
        create(:dividend,
               company_investor: company_investor,
               dividend_round: dividend_round_with_release,
               status: Dividend::ISSUED,
               signed_release_at: nil)
      end

      it "only processes dividends with signed releases when release document is required" do
        described_class.new.perform(company_investor.id)

        expect(PayInvestorDividends).to have_received(:new) do |investor, dividends|
          expect(investor).to eq(company_investor)
          dividend_ids = dividends.pluck(:id)
          expect(dividend_ids).to include(dividend1.id, dividend2.id, dividend_with_release.id)
          expect(dividend_ids).not_to include(dividend_without_release.id)
        end
      end

      context "when processing specific dividend without signed release" do
        it "does not process the dividend" do
          described_class.new.perform(company_investor.id, dividend_without_release.id)

          expect(PayInvestorDividends).to have_received(:new) do |investor, dividends|
            expect(investor).to eq(company_investor)
            expect(dividends.to_a).to be_empty
          end
        end
      end
    end

    context "when processing only paid dividends" do
      before do
        dividend1.update!(status: Dividend::PAID)
        dividend2.update!(status: Dividend::PROCESSING)
      end

      it "excludes paid and processing dividends from eligible list" do
        described_class.new.perform(company_investor.id)

        expect(PayInvestorDividends).to have_received(:new) do |investor, dividends|
          expect(investor).to eq(company_investor)
          expect(dividends.to_a).to be_empty
        end
      end
    end

    context "when tax calculation involves different tax years" do
      let!(:dividend_2023) do
        create(:dividend,
               company_investor: company_investor,
               dividend_round: dividend_round,
               status: Dividend::ISSUED,
               created_at: Date.new(2023, 12, 15),
               net_amount_in_cents: nil,
               withheld_tax_cents: nil,
               withholding_percentage: nil)
      end

      it "calculates tax for each dividend based on its creation year" do
        described_class.new.perform(company_investor.id)

        expect(DividendTaxWithholdingCalculator).to have_received(:new).with(
          company_investor,
          tax_year: 2023,
          dividends: [dividend_2023]
        )

        expect(DividendTaxWithholdingCalculator).to have_received(:new).with(
          company_investor,
          tax_year: dividend1.created_at.year,
          dividends: [dividend1]
        )
      end
    end

    context "when dividend has partial tax information" do
      before do
        dividend1.update!(
          net_amount_in_cents: 90_000,
          withheld_tax_cents: nil, # Missing
          withholding_percentage: 10.0
        )
      end

      it "updates tax information when any field is missing" do
        described_class.new.perform(company_investor.id)

        dividend1.reload
        expect(dividend1.net_amount_in_cents).to eq(85_000) # Updated
        expect(dividend1.withheld_tax_cents).to eq(15_000) # Updated
        expect(dividend1.withholding_percentage).to eq(15.0) # Updated
      end
    end

    context "error handling" do
      context "when company investor is not found" do
        it "raises ActiveRecord::RecordNotFound" do
          expect do
            described_class.new.perform(999999)
          end.to raise_error(ActiveRecord::RecordNotFound)
        end
      end

      context "when PayInvestorDividends raises an error" do
        before do
          allow(mock_pay_service).to receive(:process).and_raise(StandardError, "Payment failed")
        end

        it "allows the error to propagate" do
          expect do
            described_class.new.perform(company_investor.id)
          end.to raise_error(StandardError, "Payment failed")
        end
      end

      context "when tax calculation fails" do
        before do
          allow(mock_tax_calculator).to receive(:net_cents).and_raise(StandardError, "Tax calculation failed")
        end

        it "allows the error to propagate" do
          expect do
            described_class.new.perform(company_investor.id)
          end.to raise_error(StandardError, "Tax calculation failed")
        end
      end
    end

    context "edge cases" do
      context "when company investor has no dividends" do
        before { company_investor.dividends.destroy_all }

        it "processes successfully with empty dividend collection" do
          described_class.new.perform(company_investor.id)

          expect(PayInvestorDividends).to have_received(:new) do |investor, dividends|
            expect(investor).to eq(company_investor)
            expect(dividends.to_a).to be_empty
          end
        end
      end

      context "when user compliance info is missing" do
        before { user_compliance_info.destroy }

        it "returns early without processing" do
          described_class.new.perform(company_investor.id)

          expect(PayInvestorDividends).not_to have_received(:new)
        end
      end

      context "when user is missing" do
        before { company_investor.update!(user: nil) }

        it "raises an error due to delegation" do
          expect do
            described_class.new.perform(company_investor.id)
          end.to raise_error(NoMethodError)
        end
      end
    end
  end

  describe "sidekiq configuration" do
    it "has retry set to 0" do
      expect(described_class.sidekiq_options["retry"]).to eq(0)
    end

    it "includes Sidekiq::Job" do
      expect(described_class.ancestors).to include(Sidekiq::Job)
    end
  end

  describe "delegations" do
    it "delegates user to company_investor" do
      job = described_class.new
      job.instance_variable_set(:@company_investor, company_investor)

      expect(job.send(:user)).to eq(company_investor.user)
    end

    it "delegates tax_information_confirmed_at to user" do
      job = described_class.new
      job.instance_variable_set(:@company_investor, company_investor)

      expect(job.send(:tax_information_confirmed_at)).to eq(user.tax_information_confirmed_at)
    end

    it "delegates compliance_info to user" do
      job = described_class.new
      job.instance_variable_set(:@company_investor, company_investor)

      expect(job.send(:compliance_info)).to eq(user.compliance_info)
    end
  end
end
