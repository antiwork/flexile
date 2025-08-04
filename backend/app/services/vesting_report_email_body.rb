# frozen_string_literal: true

class VestingReportEmailBody
  def initialize(company, year, month)
    @company = company
    @year = year
    @month = month
  end

  def generate
    start_date = Date.new(@year, @month, 1)
    end_date = start_date.end_of_month

    vesting_events = VestingEvent.not_cancelled.processed
                                 .joins(equity_grant: { company_investor: :user })
                                 .joins(equity_grant: { company_investor: :company })
                                 .where(companies: { id: @company.id })
                                 .where(vesting_date: start_date..end_date)
                                 .where(processed_at: start_date..end_date)
                                 .includes(equity_grant: { company_investor: :user })

    return "No vesting events for #{Date::MONTHNAMES[@month]} #{@year}." if vesting_events.empty?

    vesting_events_by_month = vesting_events.group_by { |event| event.vesting_date.beginning_of_month }

    body_parts = []
    vesting_events_by_month.sort.each do |month_date, events|
      body_parts << "#{month_date.strftime('%B %Y')}:"

      options_per_person = events.group_by { |event| event.equity_grant.company_investor.user.legal_name }
                                 .transform_values { |person_events| person_events.sum(&:vested_shares) }

      options_per_person.each do |person_name, total_shares|
        body_parts << "#{person_name}, #{total_shares}"
      end

      body_parts << ""
    end

    body_parts.join("\n")
  end
end
