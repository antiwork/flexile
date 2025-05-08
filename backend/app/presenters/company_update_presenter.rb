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
      video_url: company_update.video_url,
      youtube_video_id: company_update.youtube_video_id,
      status: company_update.status,
    }

    if company_update.show_revenue?
      props[:revenue] = { amount_cents: company_update.company_monthly_financial_reports.sum(:revenue_cents) }
      props[:revenue][:year_over_year_change] = year_over_year_change(:revenue_cents) if has_last_year_data?
    end

    if company_update.show_net_income?
      props[:net_income] = { amount_cents: company_update.company_monthly_financial_reports.sum(:net_income_cents) }
      props[:net_income][:year_over_year_change] = year_over_year_change(:net_income_cents) if has_last_year_data?
    end

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

    def fetch_financial_data(date, period)
      period = period.to_sym
      reports = fetch_reports(date, period)
      return unless has_completed_period_data?(reports, period)

      data = { net_income: { amount_cents: reports.sum(:net_income_cents) }, revenue: { amount_cents: reports.sum(:revenue_cents) } }

      if has_last_year_data?(date:, period:)
        data[:net_income][:year_over_year_change] = year_over_year_change(:net_income_cents, date:, period:, reports:)
        data[:revenue][:year_over_year_change] = year_over_year_change(:revenue_cents, date:, period:, reports:)
      end

      data
    end

    def year_over_year_change(column, date: company_update.period_started_on, period: company_update.period, reports: company_update.company_monthly_financial_reports)
      last_year_sum = fetch_reports(date.last_year, period).sum(column)
      return if last_year_sum.zero?
      (reports.sum(column) - last_year_sum) / last_year_sum.abs.to_f
    end

    def has_completed_period_data?(reports, period)
      reports.count == CompanyUpdate.months_for_period(period)
    end

    def has_last_year_data?(date: company_update.period_started_on, period: company_update.period)
      has_completed_period_data?(fetch_reports(date.last_year, period), period)
    end

    def fetch_reports(date, period)
      report = company.company_monthly_financial_reports.where(year: date.year)
      report = report.where(month: date.month) if period.to_sym == :month
      report = report.where(month: date.beginning_of_quarter.month..date.end_of_quarter.month) if period.to_sym == :quarter
      report
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
        video_url: company_update.video_url,
        show_revenue: company_update.show_revenue?,
        show_net_income: company_update.show_net_income?,
      }
    end
end
