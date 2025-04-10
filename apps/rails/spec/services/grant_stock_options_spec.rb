# frozen_string_literal: true

RSpec.describe GrantStockOptions do
  let(:user) { create(:user) }
  let(:company) { create(:company, name: "Acme", share_price_in_usd: 17.68, fmv_per_share_in_usd: 8.68, conversion_share_price_usd: 7.68) }
  let(:company_worker) { create(:company_worker, user:, company:, pay_rate_in_subunits: 193_00) }
  let!(:option_pool) { create(:option_pool, company:, authorized_shares: 10_000_000, issued_shares: 50_000) }
  let!(:administrator) { create(:company_administrator, company:) }
  let(:board_approval_date) { "2020-08-01" }
  let(:vesting_commencement_date) { "2020-01-01" }
  let(:number_of_shares) { :calculate }
  let(:issue_date_relationship) { :consultant }
  let(:option_grant_type) { :nso }
  let(:option_expiry_months) { nil }
  let(:vesting_trigger) { "invoice_paid" }
  let(:vesting_schedule_params) { nil }
  let(:voluntary_termination_exercise_months) { nil }
  let(:involuntary_termination_exercise_months) { nil }
  let(:termination_with_cause_exercise_months) { nil }
  let(:death_exercise_months) { nil }
  let(:disability_exercise_months) { nil }
  let(:retirement_exercise_months) { nil }
  subject(:service) do
    described_class.new(company_worker, option_pool:, board_approval_date:, vesting_commencement_date:,
                                        number_of_shares:, issue_date_relationship:,
                                        option_grant_type:, option_expiry_months:, vesting_trigger:,
                                        vesting_schedule_params:, voluntary_termination_exercise_months:,
                                        involuntary_termination_exercise_months:,
                                        termination_with_cause_exercise_months:,
                                        death_exercise_months:, disability_exercise_months:,
                                        retirement_exercise_months:)
  end

  describe "#process" do
    context "when pre-requisites are unfulfilled" do
      it "rerurns an error if the contractor is an alum" do
        company_worker.ended_at = Time.current
        result = service.process
        expect(result).to eq(success: false, error: "Cannot grant stock options for #{user.display_name} because they are an alum")
      end

      it "returns an error if pay_rate_in_subunits is nil" do
        company_worker.pay_rate_in_subunits = nil
        result = service.process
        expect(result).to eq(success: false, error: "Please set the pay rate for #{user.display_name} first")
      end

      it "returns an error if fmv_per_share_in_usd is nil" do
        company.fmv_per_share_in_usd = nil
        result = service.process
        expect(result).to eq(success: false, error: "Please set the company's current FMV (409A valuation) first")
      end

      it "returns an error if conversion_share_price_usd is nil" do
        company.conversion_share_price_usd = nil
        result = service.process
        expect(result).to eq(success: false, error: "Please set the company's conversion share price first")
      end
    end

    context "when company_investor exists" do
      let(:investor) { create(:company_investor, company:, user:) }
      let(:board_approval_date) { "2024-01-01" }
      let(:option_grant_type) { :iso }
      let(:issue_date_relationship) { :employee }

      it "creates an equity grant with the correct attributes" do
        company_worker.update!(started_at: "1 Jan 2021")
        travel_to("12 May 2023")

        # weeks in period (2023) = 52.142857142857142857142857142857142857 (365 days)
        # max_bill_in_usd = 35 (max hours) * <weeks in period> * 193 (hourly rate)
        # number_of_shares = (max_bill_in_usd / company.conversion_share_price_usd).ceil
        number_of_shares = 45_863
        args_for_new = {
          company_investor: investor,
          option_pool:,
          share_price_usd: 7.68,
          exercise_price_usd: 8.68,
          number_of_shares:,
          vested_shares: 0,
          period_started_at: DateTime.parse("1 Jan 2023").beginning_of_year,
          period_ended_at: DateTime.parse("1 Jan 2023").end_of_year,
          issue_date_relationship:,
          board_approval_date:,
          option_grant_type:,
          option_expiry_months:,
          vesting_trigger:,
          vesting_schedule: nil,
          voluntary_termination_exercise_months:,
          involuntary_termination_exercise_months:,
          termination_with_cause_exercise_months:,
          death_exercise_months:,
          disability_exercise_months:,
          retirement_exercise_months:,
        }
        expect(EquityGrantCreation).to receive(:new).with(**args_for_new).and_call_original

        expect do
          service.process
        end.to change { CompanyInvestor.count }.by(0)
           .and change { EquityGrant.count }.by(1)
           .and change { Document.equity_plan_contract.count }.by(1)
           .and change { DocumentSignature.count }.by(2)

        equity_grant = EquityGrant.last
        expect(equity_grant.option_pool).to eq(option_pool)
        expect(equity_grant.company_investor).to eq(investor)
        expect(equity_grant.name).to eq("ACM-1")
        expect(equity_grant.issue_date_relationship_employee?).to be(true)
        expect(equity_grant.board_approval_date).to eq(Date.parse(board_approval_date))
        expect(equity_grant.option_grant_type_iso?).to be(true)
        expect(equity_grant.period_started_at).to eq(DateTime.parse("1 Jan 2023").beginning_of_year)
        expect(equity_grant.period_ended_at).to be_within(2.second).of(DateTime.parse("1 Jan 2023").end_of_year)
        expect(equity_grant.vesting_trigger_invoice_paid?).to be(true)
        expect(equity_grant.vesting_schedule).to be_nil
        expect(equity_grant.vesting_events).to be_empty
        expect(equity_grant.voluntary_termination_exercise_months).to eq(120)
        expect(equity_grant.involuntary_termination_exercise_months).to eq(120)
        expect(equity_grant.termination_with_cause_exercise_months).to eq(0)
        expect(equity_grant.death_exercise_months).to eq(120)
        expect(equity_grant.disability_exercise_months).to eq(120)
        expect(equity_grant.retirement_exercise_months).to eq(120)

        contract = Document.equity_plan_contract.last
        expect(contract.company).to eq(company)
        expect(contract.year).to eq(Date.current.year)
        expect(contract.equity_grant).to eq(equity_grant)
        expect(contract.name).to eq("Equity Incentive Plan #{Date.current.year}")

        expect(contract.signatures.count).to eq(2)
        expect(contract.signatures.first.user).to eq(user)
        expect(contract.signatures.first.title).to eq("Signer")
        expect(contract.signatures.last.user).to eq(administrator.user)
        expect(contract.signatures.last.title).to eq("Company Representative")
      end

      context "when number of shares is provided" do
        let(:number_of_shares) { 500 }

        it "grants the provided number of shares" do
          expect { service.process }.to change { EquityGrant.count }.by(1)
          expect(EquityGrant.last.number_of_shares).to eq(500)
        end
      end
    end

    context "when company_investor does not exist" do
      it "creates a company investor and associates the new equity grant to it" do
        company_worker.update!(started_at: "1 Jan 2021")
        user.update!(country_code: "IN")

        travel_to("12 May 2024")

        # weeks in period (2024) = 52.285714285714285714285714285714285714 (leap year: 366 days)
        # max_bill_in_usd = 35 (max hours) * <weeks in period> * 193 (hourly rate)
        # number_of_shares = (max_bill_in_usd / company.conversion_share_price_usd).ceil
        number_of_shares = 45_989
        args_for_new = {
          company_investor: an_instance_of(CompanyInvestor),
          option_pool:,
          share_price_usd: 7.68,
          exercise_price_usd: 8.68,
          number_of_shares:,
          vested_shares: 0,
          period_started_at: DateTime.parse("1 Jan 2024").beginning_of_year,
          period_ended_at: DateTime.parse("1 Jan 2024").end_of_year,
          issue_date_relationship: :consultant,
          board_approval_date:,
          option_grant_type: :nso,
          option_expiry_months:,
          vesting_trigger:,
          vesting_schedule: nil,
          voluntary_termination_exercise_months:,
          involuntary_termination_exercise_months:,
          termination_with_cause_exercise_months:,
          death_exercise_months:,
          disability_exercise_months:,
          retirement_exercise_months:,
        }
        expect(EquityGrantCreation).to receive(:new).with(**args_for_new).and_call_original

        expect do
          service.process
        end.to change { CompanyInvestor.count }.by(1)
           .and change { EquityGrant.count }.by(1)
           .and change { Document.equity_plan_contract.count }.by(1)
           .and change { DocumentSignature.count }.by(2)
        investor = CompanyInvestor.last
        expect(investor.company).to eq(company)
        expect(investor.user).to eq(user)
        expect(investor.investment_amount_in_cents).to eq(0)

        equity_grant = EquityGrant.last
        expect(equity_grant.option_pool).to eq(option_pool)
        expect(equity_grant.company_investor).to eq(investor)
        expect(equity_grant.name).to eq("ACM-1")
        expect(equity_grant.issue_date_relationship_consultant?).to be(true)
        expect(equity_grant.board_approval_date).to eq(Date.parse(board_approval_date))
        expect(equity_grant.option_grant_type_nso?).to be(true)

        contract = Document.equity_plan_contract.last
        expect(contract.company).to eq(company)
        expect(contract.year).to eq(Date.current.year)
        expect(contract.equity_grant).to eq(equity_grant)
        expect(contract.name).to eq("Equity Incentive Plan #{Date.current.year}")

        expect(contract.signatures.count).to eq(2)
        expect(contract.signatures.first.user).to eq(user)
        expect(contract.signatures.first.title).to eq("Signer")
        expect(contract.signatures.last.user).to eq(administrator.user)
        expect(contract.signatures.last.title).to eq("Company Representative")
      end

      it "does not grant options and returns an error when the user's residence country " \
         "is unsupported by our contracts" do
        company_worker.user.update!(country_code: "CN")

        expect do
          result = service.process
          expect(result).to eq(success: false, error: "Equity contract not appropriate for #{user.display_name} from country China")
        end.to change { CompanyInvestor.count }.by(0)
           .and change { EquityGrant.count }.by(0)
           .and change { Contract.count }.by(0)
      end
    end

    it "calculates the options to grant correctly if the contractor joins mid-year" do
      company_worker.update!(started_at: "7 April 2023")
      travel_to("12 May 2023")

      # weeks in period (7-Apr-23 to 31-Dec-23) = 38.428571428571428571428571428571428571
      # max_bill_in_usd = 35 (max hours) * <weeks in period> * 193 (hourly rate)
      # number_of_shares = (max_bill_in_usd / company.conversion_share_price_usd).ceil
      number_of_shares = 33_801
      args_for_new = {
        period_started_at: DateTime.parse("7 April 2023"),
        period_ended_at: DateTime.parse("7 April 2023").end_of_year,
        number_of_shares:,
        issue_date_relationship: :consultant,
        option_grant_type: :nso,
      }
      expect(EquityGrantCreation).to receive(:new).with(hash_including(args_for_new)).and_call_original

      expect do
        service.process
      end.to change { CompanyInvestor.count }.by(1)
         .and change { EquityGrant.count }.by(1)
         .and have_enqueued_mail(CompanyWorkerMailer, :equity_grant_issued)

      investor = CompanyInvestor.last
      expect(investor.company).to eq(company)
      expect(investor.user).to eq(user)
      expect(investor.investment_amount_in_cents).to eq(0)
      equity_grant = EquityGrant.last
      expect(equity_grant.company_investor).to eq(investor)
      expect(equity_grant.issue_date_relationship_consultant?).to be(true)
      expect(equity_grant.option_grant_type_nso?).to be(true)
    end

    context "when vesting_trigger is scheduled" do
      let(:vesting_trigger) { "scheduled" }
      let(:vesting_schedule) { create(:vesting_schedule, :four_year_with_one_year_cliff) }
      let(:vesting_schedule_params) { { vesting_schedule_id: vesting_schedule.external_id } }

      it "sets period_started_at and period_ended_at correctly when vesting schedule is provided" do
        args_for_new = {
          board_approval_date:,
          period_started_at: DateTime.parse(vesting_commencement_date).beginning_of_day,
          period_ended_at: DateTime.parse(vesting_commencement_date).end_of_day + vesting_schedule.total_vesting_duration_months.months,
          vesting_schedule:,
        }
        expect(EquityGrantCreation).to receive(:new).with(hash_including(args_for_new)).and_call_original

        expect do
          result = service.process
          expect(result).to eq(success: true, document: Document.last)
        end.to change { EquityGrant.count }.by(1)

        equity_grant = EquityGrant.last
        expect(equity_grant.period_started_at).to eq(DateTime.parse(vesting_commencement_date).beginning_of_day)
        expect(equity_grant.period_ended_at).to be_within(2.second).of(DateTime.parse(vesting_commencement_date).end_of_day + vesting_schedule.total_vesting_duration_months.months)
        expect(equity_grant.vesting_trigger_scheduled?).to be(true)
        expect(equity_grant.vesting_schedule).to eq(vesting_schedule)
        expect(equity_grant.vesting_events.count).to eq(37)
      end

      context "when custom vesting schedule params are provided" do
        let(:vesting_schedule_params) { { total_vesting_duration_months: 12, cliff_duration_months: 6, vesting_frequency_months: 1 } }

        it "creates a vesting schedule if it doesn't exist" do
          args_for_new = {
            vesting_schedule: an_instance_of(VestingSchedule),
          }
          expect(EquityGrantCreation).to receive(:new).with(hash_including(args_for_new)).and_call_original

          expect do
            result = service.process
            expect(result).to eq(success: true, document: Document.last)
            equity_grant = EquityGrant.last
            expect(equity_grant.vesting_schedule).to have_attributes(vesting_schedule_params.except(:vesting_schedule_id).to_h.symbolize_keys)
          end.to change { VestingSchedule.count }.by(1)
        end
      end
    end
  end
end
