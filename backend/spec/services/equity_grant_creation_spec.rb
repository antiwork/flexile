# frozen_string_literal: true

RSpec.describe EquityGrantCreation do
  let(:company) { create(:company, name: "Acme") }
  let(:company_investor) { create(:company_investor, company:) }
  let(:option_pool) do
    create(:option_pool, company:, authorized_shares: 2_001, issued_shares: 1_000)
  end
  let(:args) do
    {
      company_investor:,
      option_pool:,
      share_price_usd: 11.38,
      exercise_price_usd: 2.58,
      number_of_shares: 1_001,
      vested_shares: 99,
      period_started_at: Date.new(2018, 1, 1),
      period_ended_at: Date.new(2018, 12, 31),
      issue_date_relationship: "employee",
      board_approval_date: Date.new(2020, 1, 1),
      option_grant_type: "iso",
      option_expiry_months: 36,
      vesting_trigger: "invoice_paid",
      vesting_schedule: nil,
      voluntary_termination_exercise_months: 3,
      involuntary_termination_exercise_months: 3,
      termination_with_cause_exercise_months: 0,
      death_exercise_months: 18,
      disability_exercise_months: 12,
      retirement_exercise_months: 3,
    }
  end

  context "when the option pool doesn't have enough shares available" do
    before do
      option_pool.update!(authorized_shares: 2_000)
    end

    it "returns an error" do
      expect do
        result = described_class.new(**args).process
        expect(result.success?).to be(false)
        expect(result.error).to eq(%Q(Not enough shares available in the option pool "#{option_pool.name}" to create an equity grant for investor "#{company_investor.user.display_name}"))
        expect(result.equity_grant).to be_nil
      end.to change { EquityGrant.count }.by(0)
    end
  end

  it "creates an equity grant record using the provided attributes" do
    result = nil
    expect do
      result = described_class.new(**args).process
    end.to change { EquityGrant.count }.by(1)
       .and change { CompanyInvestorEntity.count }.by(1)

    company_investor_entity = CompanyInvestorEntity.last
    expect(result.success?).to be(true)
    expect(result.equity_grant).to be_persisted
    expect(result.equity_grant.company_investor_id).to eq(company_investor.id)
    expect(result.equity_grant.company_investor_entity_id).to eq(company_investor_entity.id)
    expect(result.equity_grant.option_holder_name).to eq(company_investor.user.legal_name)
    expect(result.equity_grant.option_pool_id).to eq(option_pool.id)
    expect(result.equity_grant.name).to eq("ACM-1")
    expect(result.equity_grant.share_price_usd).to eq(11.38)
    expect(result.equity_grant.exercise_price_usd).to eq(2.58)
    expect(result.equity_grant.number_of_shares).to eq(1_001)
    expect(result.equity_grant.vested_shares).to eq(99)
    expect(result.equity_grant.unvested_shares).to eq(1_001 - 99)
    expect(result.equity_grant.exercised_shares).to eq(0)
    expect(result.equity_grant.forfeited_shares).to eq(0)
    expect(result.equity_grant.period_started_at).to eq(Date.new(2018, 1, 1))
    expect(result.equity_grant.period_ended_at).to eq(Date.new(2018, 12, 31))
    expect(result.equity_grant.issued_at).to be_within(2.seconds).of(Time.current)
    expect(result.equity_grant.expires_at).to be_within(2.seconds).of(Time.current + 36.months)
    expect(result.equity_grant.issue_date_relationship_employee?).to be(true)
    expect(result.equity_grant.board_approval_date).to eq(Date.new(2020, 1, 1))
    expect(result.equity_grant.option_grant_type_iso?).to be(true)
    expect(result.equity_grant.vesting_trigger_invoice_paid?).to be(true)
    expect(result.equity_grant.vesting_events).to be_empty
    expect(result.equity_grant.voluntary_termination_exercise_months).to eq(3)
    expect(result.equity_grant.involuntary_termination_exercise_months).to eq(3)
    expect(result.equity_grant.termination_with_cause_exercise_months).to eq(0)
    expect(result.equity_grant.death_exercise_months).to eq(18)
    expect(result.equity_grant.disability_exercise_months).to eq(12)
    expect(result.equity_grant.retirement_exercise_months).to eq(3)

    expect(company_investor_entity.company_id).to eq(company.id)
    expect(company_investor_entity.email).to eq(company_investor.user.email)
    expect(company_investor_entity.investment_amount_cents).to eq(0)
    expect(company_investor_entity.name).to eq(result.equity_grant.option_holder_name)

    expect(option_pool.issued_shares).to eq(1000 + 1001) # Initial value + new shares
    expect(company_investor.total_options).to eq(0 + 1001) # Initial value + new shares
    expect(company_investor_entity.total_options).to eq(0 + 1001) # Initial value + new shares
  end

  it "creates vesting events based on the vesting schedule when the vesting_trigger is scheduled" do
    vesting_schedule = create(:vesting_schedule, :four_year_with_one_year_cliff)
    period_started_at = Date.new(2018, 1, 1)

    result = described_class.new(**args.merge(
      vesting_trigger: "scheduled",
      vesting_schedule:,
      period_started_at:,
      period_ended_at: period_started_at + vesting_schedule.total_vesting_duration_months.months,
    )).process

    expect(result.success?).to be(true)
    expect(result.equity_grant).to be_persisted
    expect(result.equity_grant.vesting_schedule).to eq(vesting_schedule)
    expect(result.equity_grant.vesting_trigger_scheduled?).to be(true)
    expect(result.equity_grant.vesting_events.count).to eq(37)
    expect(result.equity_grant.vesting_events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                                            [Date.new(2019, 1, 1), 240], # Cliff vesting
                                                                                            *35.times.map { |i| [Date.new(2019, 1, 1) + (i + 1).months, 20] }, # Monthly vesting post cliff
                                                                                            [Date.new(2022, 1, 1), 61], # Final vesting
                                                                                          ])
  end

  it "returns an error when the vesting events cannot be created as per the vesting schedule" do
    vesting_schedule = create(:vesting_schedule, :four_year_without_cliff)

    expect do
      result = described_class.new(**args.merge(
        number_of_shares: 10,
        vested_shares: 0,
        vesting_trigger: "scheduled",
        vesting_schedule:,
        period_started_at: Date.new(2018, 1, 1),
        period_ended_at: Date.new(2022, 12, 31),
      )).process
      expect(result.success?).to be(false)
      expect(result.equity_grant).to be_nil
      expect(result.error).to eq("Not enough number of shares to setup the provided vesting schedule")
    end.to change { EquityGrant.count }.by(0)
       .and change { option_pool.reload.issued_shares }.by(0)
       .and change { company_investor.reload.total_options }.by(0)
       .and change { VestingEvent.count }.by(0)
  end

  it "selects the next grant name correctly" do
    create(:equity_grant, option_pool:, company_investor:, name: "XY12234")

    result = described_class.new(**args).process

    expect(result.success?).to be(true)
    expect(result.equity_grant).to be_persisted
    expect(result.equity_grant.name).to eq("XY12235")
  end

  it "cancels the existing grant when the new grant is for the same period" do
    equity_grant = create(:equity_grant, option_pool:, company_investor:,
                                         name: "XY12234",
                                         period_started_at: Date.new(2018, 1, 1),
                                         period_ended_at: Date.new(2018, 12, 31),
                                         forfeited_shares: 0,
                                         vested_shares: 100,
                                         unvested_shares: 900,
                                         exercised_shares: 0,
                                         number_of_shares: 1_000,)
    company_investor.update!(total_options: 1_000)
    result = nil
    expect do
      result = described_class.new(**args).process
    end.to change { EquityGrant.count }.by(1)
       .and change { CompanyInvestorEntity.count }.by(1)

    expect(result.success?).to be(true)
    expect(equity_grant.reload.vested_shares).to eq(100)
    expect(equity_grant.unvested_shares).to eq(0)
    expect(equity_grant.forfeited_shares).to eq(900)
    expect(company_investor.reload.total_options).to eq(1101)
    expect(option_pool.reload.issued_shares).to eq(1101)
    expect(option_pool.available_shares).to eq(900)
  end

  describe "Option holder name" do
    before { company_investor.user.update!(legal_name: "Jack Beanstalk") }

    context "when the user is a business entity" do
      before do
        company_investor.user.compliance_info.update!(business_entity: true, business_name: "Acme Inc.")
      end

      it "uses the user's legal name when the residence country is India" do
        company_investor.user.update!(country_code: "IN")

        result = described_class.new(**args).process

        expect(result.equity_grant.option_holder_name).to eq("Jack Beanstalk")
      end

      it "uses the business name when the residence country is not India" do
        result = described_class.new(**args).process

        expect(result.equity_grant.option_holder_name).to eq("Acme Inc.")
      end
    end

    context "when the user is not a business entity" do
      it "uses the user's legal name" do
        result = described_class.new(**args).process

        expect(result.equity_grant.option_holder_name).to eq("Jack Beanstalk")
      end
    end
  end

  it "uses the default post-exit exercise periods from the option pool when not provided" do
    option_pool.update!(
      default_option_expiry_months: 10,
      voluntary_termination_exercise_months: 12,
      involuntary_termination_exercise_months: 12,
      termination_with_cause_exercise_months: 6,
      death_exercise_months: 60,
      disability_exercise_months: 24,
      retirement_exercise_months: 36,
    )
    result = described_class.new(**args.without(:option_expiry_months, :voluntary_termination_exercise_months, :involuntary_termination_exercise_months, :termination_with_cause_exercise_months, :death_exercise_months, :disability_exercise_months, :retirement_exercise_months)).process

    expect(result.equity_grant.expires_at).to be_within(2.seconds).of(Time.current + 10.months)
    expect(result.equity_grant.involuntary_termination_exercise_months).to eq(12)
    expect(result.equity_grant.termination_with_cause_exercise_months).to eq(6)
    expect(result.equity_grant.death_exercise_months).to eq(60)
    expect(result.equity_grant.disability_exercise_months).to eq(24)
    expect(result.equity_grant.retirement_exercise_months).to eq(36)
  end
end
