# frozen_string_literal: true

class CompanyUpdateEmailJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(company_update_id, user_id)
    CompanyUpdateMailer.update_published(company_update_id:, user_id:).deliver_now
  end
end
