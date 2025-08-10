# frozen_string_literal: true

class CompanyUpdatePresenter
  def initialize(company_update)
    @company_update = company_update
    @company = company_update.company
  end

  def form_props
    today = Date.current

    financial_periods = %i[month quarter year].map do |period|
      date = today.public_send("last_#{period}").public_send("beginning_of_#{period}")
      {
        label: "#{period_label(date, period)} (Last #{period})",
        period:,
        period_started_on: date.to_s,
      }.merge(fetch_financial_data(date, period) || {})
    end

    props = {
      financial_periods:,
      recipient_count: {
        contractors: company.company_workers.active.count,
        investors: company.company_investors.where.not(user_id: company.company_workers.active.select(:user_id)).count,
      },
    }

    if company_update.persisted?
      if company_update.period.present? && props[:financial_periods].none? { _1[:period] == company_update.period.to_sym && _1[:period_started_on] == company_update.period_started_on.to_s }
        props[:financial_periods] << {
          label: "#{period_label(company_update.period_started_on, company_update.period)} (Original period)",
          period: company_update.period,
          period_started_on: company_update.period_started_on.to_s,
        }.merge(fetch_financial_data(company_update.period_started_on, company_update.period) || {})
      end
      props[:company_update] = present_update(company_update)
    end

    props
  end

  def props
    props = {
      id: company_update.external_id,
      title: company_update.title,
      period_label: company_update.period ? period_label(company_update.period_started_on, company_update.period) : nil,
      sender_name: company.primary_admin.user.name,
      body: company_update.body,
      status: company_update.status,
    }



    props
  end

  private
    attr_reader :company_update, :company

    def period_label(time, period)
      case period.to_sym
      when :month then "#{time.strftime("%B")} #{time.year}"
      when :quarter then "Q#{time.quarter} #{time.year}"
      when :year then time.year.to_s
      end
    end



    def present_update(company_update)
      {
        id: company_update.external_id,
        title: company_update.title,
        body: company_update.body,
        period: company_update.period,
        period_started_on: company_update.period_started_on,
        sent_at: company_update.sent_at,
        status: company_update.status,
        show_revenue: company_update.show_revenue?,
        show_net_income: company_update.show_net_income?,
      }
    end
end
