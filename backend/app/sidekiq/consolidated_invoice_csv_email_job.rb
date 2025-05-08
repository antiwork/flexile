# frozen_string_literal: true

class ConsolidatedInvoiceCsvEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(recipients)
    return unless Rails.env.production?

    invoices = ConsolidatedInvoice.includes(:company, :consolidated_payments, invoices: :payments).where("created_at > ?", Time.current.last_month.beginning_of_month).order(created_at: :asc)
    attached = { "ConsolidatedInvoices.csv" => ConsolidatedInvoiceCsv.new(invoices).generate }
    AdminMailer.custom(to: recipients, subject: "Flexile Consolidated Invoices CSV", body: "Attached", attached:).deliver_later
  end
end
