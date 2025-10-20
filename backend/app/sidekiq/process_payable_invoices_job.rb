# frozen_string_literal: true

class ProcessPayableInvoicesJob
  include Sidekiq::Job

  sidekiq_options retry: 3

  def perform(company_id, user_id = nil)
    company = Company.find(company_id)
    user = user_id && User.find_by(id: user_id)
    ProcessPayableInvoices.new(company:, user:).perform
  end
end
