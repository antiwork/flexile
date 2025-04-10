# frozen_string_literal: true

class GrantStockOptions
  MAX_HOURS_PER_WEEK = 35
  private_constant :MAX_HOURS_PER_WEEK

  def initialize(company_worker, option_pool:, board_approval_date:, vesting_commencement_date:,
                number_of_shares: :calculate, issue_date_relationship:, option_grant_type:, option_expiry_months:,
                vesting_trigger:, vesting_schedule_params:, voluntary_termination_exercise_months:,
                involuntary_termination_exercise_months:, termination_with_cause_exercise_months:,
                death_exercise_months:, disability_exercise_months:, retirement_exercise_months:)
    @company_worker = company_worker
    @option_pool = option_pool
    @company = company_worker.company
    @board_approval_date = board_approval_date
    @vesting_commencement_date = vesting_commencement_date
    @number_of_shares = number_of_shares
    @issue_date_relationship = issue_date_relationship
    @option_grant_type = option_grant_type
    @option_expiry_months = option_expiry_months
    @vesting_trigger = vesting_trigger
    @vesting_schedule_params = vesting_schedule_params || {}
    @voluntary_termination_exercise_months = voluntary_termination_exercise_months
    @involuntary_termination_exercise_months = involuntary_termination_exercise_months
    @termination_with_cause_exercise_months = termination_with_cause_exercise_months
    @death_exercise_months = death_exercise_months
    @disability_exercise_months = disability_exercise_months
    @retirement_exercise_months = retirement_exercise_months
  end

  def process
    user = company_worker.user

    return { success: false, error: "Cannot grant stock options for #{user.display_name} because they are an alum" } if company_worker.alumni?
    return { success: false, error: "Please set the pay rate for #{user.display_name} first" } if company_worker.pay_rate_in_subunits.nil?
    return { success: false, error: "Please set the company's conversion share price first" } if company.conversion_share_price_usd.nil?
    return { success: false, error: "Please set the company's current FMV (409A valuation) first" } if company.fmv_per_share_in_usd.nil?
    return { success: false, error: "Equity contract not appropriate for #{user.display_name} from country #{ISO3166::Country[user.country_code]}" } unless EquityContractCountrySupport.new(user).supported?

    company_investor =
      user.company_investors.find_or_create_by!(company:) do |investor|
        investor.investment_amount_in_cents = 0
        investor.user_id = user.id
      end

    if vesting_trigger == EquityGrant.vesting_triggers[:scheduled]
      vesting_schedule_id = vesting_schedule_params[:vesting_schedule_id]
      vesting_schedule = VestingSchedule.find_by(external_id: vesting_schedule_id) if vesting_schedule_id.present?
      vesting_schedule ||= VestingSchedule.find_or_create_by!(vesting_schedule_params.except(:vesting_schedule_id).to_h.symbolize_keys)
    end

    if vesting_trigger == EquityGrant.vesting_triggers[:scheduled] && vesting_schedule.present?
      period_started_at = Date.parse(vesting_commencement_date).beginning_of_day
      period_ended_at = period_started_at.end_of_day + vesting_schedule.total_vesting_duration_months.months
    else
      period_started_at = [company_worker.started_at, DateTime.current.beginning_of_year].max
      period_ended_at = period_started_at.end_of_year
    end
    exercise_price_usd = company.fmv_per_share_in_usd
    share_price_usd = company.conversion_share_price_usd

    number_of_shares = @number_of_shares == :calculate ? calculate_number_of_shares(period_started_at, period_ended_at) : @number_of_shares

    equity_grant_creation_result = EquityGrantCreation.new(company_investor:, option_pool:, option_grant_type:, share_price_usd:,
                                                           exercise_price_usd:, number_of_shares:,
                                                           vested_shares: 0, period_started_at:, period_ended_at:,
                                                           board_approval_date:, issue_date_relationship:,
                                                           option_expiry_months:, vesting_trigger:,
                                                           vesting_schedule:, voluntary_termination_exercise_months:,
                                                           involuntary_termination_exercise_months:,
                                                           termination_with_cause_exercise_months:,
                                                           death_exercise_months:, disability_exercise_months:,
                                                           retirement_exercise_months:)
                                                      .process
    if equity_grant_creation_result.success?
      equity_grant = equity_grant_creation_result.equity_grant
    else
      return { success: false, error: equity_grant_creation_result.error }
    end

    company_administrator = company.primary_admin

    contract_params = {
      equity_grant:,
      company:,
      name: "Equity Incentive Plan #{Date.current.year}",
    }
    document = company_worker.user.documents.build(**contract_params, year: Date.current.year, document_type: :equity_plan_contract)
    document.signatures.build(user:, title: "Signer")
    document.signatures.build(user: company_administrator.user, title: "Company Representative")
    document.save!
    CompanyWorkerMailer.equity_grant_issued(equity_grant.id).deliver_later

    { success: true, document: }
  end

  private
    attr_reader :company_worker, :option_pool, :option_grant_type, :company, :board_approval_date,
                :vesting_commencement_date, :issue_date_relationship, :option_expiry_months, :vesting_trigger,
                :vesting_schedule_params, :voluntary_termination_exercise_months,
                :involuntary_termination_exercise_months, :termination_with_cause_exercise_months,
                :death_exercise_months, :disability_exercise_months, :retirement_exercise_months

    def calculate_number_of_shares(period_started_at, period_ended_at)
      days_in_period = (period_ended_at.to_date - period_started_at.to_date).to_i + 1
      weeks_in_period = days_in_period / 7.to_d
      max_bill_in_usd = weeks_in_period * MAX_HOURS_PER_WEEK * company_worker.pay_rate_in_subunits / 100.to_d
      (max_bill_in_usd / company.conversion_share_price_usd).ceil
    end
end
