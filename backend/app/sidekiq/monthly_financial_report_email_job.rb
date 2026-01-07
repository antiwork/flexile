# frozen_string_literal: true

class MonthlyFinancialReportEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(recipients)
    start_date = Date.today.last_month.beginning_of_month
    end_date = start_date.end_of_month

    attached = FinancialReportCsvService.new(start_date:, end_date:).process
    subject = "Flexile monthly financial report - #{start_date.strftime("%B %Y")}"

    AdminMailer.custom(to: recipients, subject: subject, body: "Attached", attached: attached).deliver_later
  end
end
