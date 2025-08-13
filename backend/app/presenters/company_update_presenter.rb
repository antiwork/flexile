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
        label: "Last #{period}",
        period:,
        period_started_on: date.to_s,
      }
    end

    props = {
      financial_periods:,
      recipient_count: {
        contractors: company.company_workers.active.count,
        investors: company.company_investors.where.not(user_id: company.company_workers.active.select(:user_id)).count,
      },
    }

    if company_update.persisted?
      props[:company_update] = present_update(company_update)
    end

    props
  end

  def props
    props = {
      id: company_update.external_id,
      title: company_update.title,
      sender_name: company.primary_admin.user.name,
      body: company_update.body,
      status: company_update.status,
    }



    props
  end

  private
    attr_reader :company_update, :company




    def present_update(company_update)
      {
        id: company_update.external_id,
        title: company_update.title,
        body: company_update.body,
        sent_at: company_update.sent_at,
        status: company_update.status,
      }
    end
end
