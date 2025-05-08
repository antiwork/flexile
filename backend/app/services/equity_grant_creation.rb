# frozen_string_literal: true

class EquityGrantCreation
  Result = Struct.new(:success?, :error, :equity_grant)

  def initialize(company_investor:, option_pool:, option_grant_type:, share_price_usd:, exercise_price_usd:, number_of_shares:,
                 vested_shares:, period_started_at:, period_ended_at:, issue_date_relationship:,
                 option_expiry_months: nil, vesting_trigger:, vesting_schedule:, voluntary_termination_exercise_months: nil, involuntary_termination_exercise_months: nil,
                 termination_with_cause_exercise_months: nil, death_exercise_months: nil, disability_exercise_months: nil,
                 retirement_exercise_months: nil)
    @company_investor = company_investor
    @user = company_investor.user
    @option_pool = option_pool
    @option_grant_type = option_grant_type
    @share_price_usd = share_price_usd
    @exercise_price_usd = exercise_price_usd
    @number_of_shares = number_of_shares || 0
    @vested_shares = vested_shares
    @unvested_shares = number_of_shares - vested_shares
    @period_started_at = period_started_at
    @period_ended_at = period_ended_at
    @issue_date_relationship = issue_date_relationship
    @option_expiry_months = option_expiry_months
    @vesting_trigger = vesting_trigger
    @vesting_schedule = vesting_schedule
    @voluntary_termination_exercise_months = voluntary_termination_exercise_months
    @involuntary_termination_exercise_months = involuntary_termination_exercise_months
    @termination_with_cause_exercise_months = termination_with_cause_exercise_months
    @death_exercise_months = death_exercise_months
    @disability_exercise_months = disability_exercise_months
    @retirement_exercise_months = retirement_exercise_months
  end

  def process
    option_pool.with_lock do
      return build_result(success: false, error: %Q(Not enough shares available in the option pool "#{option_pool.name}" to create an equity grant for investor "#{user.display_name}")) if insufficient_available_shares?

      current_time = Time.current

      company_investor_entity =
        company_investor.company.company_investor_entities.find_or_create_by!(name: option_holder_name, email: user.email) do |investor_entity|
          investor_entity.investment_amount_cents = 0
        end

      current_grant = company_investor.equity_grants.vesting_trigger_invoice_paid
        .where("EXTRACT(year FROM period_ended_at) = ? AND unvested_shares > 0", period_ended_at.year)
        .order(id: :desc)
        .first
      if current_grant.present?
        forfeited_shares = current_grant.unvested_shares
        total_forfeited_shares = forfeited_shares + current_grant.forfeited_shares

        current_grant.equity_grant_transactions.create!(
          transaction_type: EquityGrantTransaction.transaction_types[:cancellation],
          forfeited_shares:,
          total_number_of_shares: current_grant.number_of_shares,
          total_vested_shares: current_grant.vested_shares,
          total_unvested_shares: 0,
          total_exercised_shares: current_grant.exercised_shares,
          total_forfeited_shares:,
        )
        current_grant.update!(forfeited_shares: total_forfeited_shares, unvested_shares: 0)
        current_grant.option_pool.decrement!(:issued_shares, forfeited_shares)
      end

      grant = company_investor.equity_grants.build(
        company_investor_entity:,
        option_holder_name:,
        option_pool:,
        name: next_grant_name,
        period_started_at:,
        period_ended_at:,
        number_of_shares:,
        vested_shares:,
        unvested_shares:,
        exercised_shares: 0,
        forfeited_shares: 0,
        share_price_usd:,
        exercise_price_usd:,
        issued_at: current_time,
        expires_at: current_time + (option_expiry_months || option_pool.default_option_expiry_months).months,
        issue_date_relationship:,
        option_grant_type:,
        vesting_trigger:,
        vesting_schedule:,
        voluntary_termination_exercise_months: voluntary_termination_exercise_months || option_pool.voluntary_termination_exercise_months,
        involuntary_termination_exercise_months: involuntary_termination_exercise_months || option_pool.involuntary_termination_exercise_months,
        termination_with_cause_exercise_months: termination_with_cause_exercise_months || option_pool.termination_with_cause_exercise_months,
        death_exercise_months: death_exercise_months || option_pool.death_exercise_months,
        disability_exercise_months: disability_exercise_months || option_pool.disability_exercise_months,
        retirement_exercise_months: retirement_exercise_months || option_pool.retirement_exercise_months,
      )
      vesting_events = grant.build_vesting_events
      if grant.vesting_trigger_scheduled? && vesting_events.empty?
        return build_result(success: false, error: "Not enough number of shares to setup the provided vesting schedule")
      else
        grant.save!
        vesting_events.each(&:save!)
      end

      option_pool.increment!(:issued_shares, number_of_shares)
      company_investor.increment!(:total_options, number_of_shares)
      company_investor_entity.increment!(:total_options, number_of_shares)

      build_result(success: true, equity_grant: grant)
    end
  end

  private
    attr_reader :company_investor, :user, :option_pool, :name, :share_price_usd, :exercise_price_usd, :number_of_shares,
                :vested_shares, :unvested_shares, :period_started_at, :period_ended_at, :issue_date_relationship,
                :option_grant_type, :option_expiry_months, :vesting_trigger,
                :vesting_schedule, :voluntary_termination_exercise_months,
                :involuntary_termination_exercise_months, :termination_with_cause_exercise_months,
                :death_exercise_months, :disability_exercise_months, :retirement_exercise_months

    def insufficient_available_shares?
      option_pool.available_shares < number_of_shares
    end

    def next_grant_name
      company = company_investor.company

      preceding_grant = company.equity_grants.order(id: :desc).first
      return "#{company.name.first(3).upcase}-1" if preceding_grant.nil?

      preceding_grant_digits = preceding_grant.name.scan(/\d+\z/).last
      preceding_grant_number = preceding_grant_digits.to_i

      next_grant_number = preceding_grant_number + 1
      preceding_grant.name.reverse.sub(preceding_grant_digits.reverse, next_grant_number.to_s.reverse).reverse
    end

    def option_holder_name
      @_option_holder_name ||= begin
        return user.legal_name unless user.business_entity?

        if ISO3166::Country[:IN] == ISO3166::Country[user.country_code]
          user.legal_name
        else
          user.business_name
        end
      end
    end

    def build_result(success:, error: nil, equity_grant: nil)
      Result.new(success, error, equity_grant)
    end
end
