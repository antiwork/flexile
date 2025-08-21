# frozen_string_literal: true

class CompanyUpdateEmailsJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_update_external_id, recipient_user_ids = nil)
    company_update = CompanyUpdate.find_by!(external_id: company_update_external_id)
    company = company_update.company

    # Get recipients - either provided user IDs or all contractors/investors
    recipients = if recipient_user_ids.present?
      User.where(id: recipient_user_ids)
    else
      get_default_recipients(company)
    end

    # Send emails to all recipients
    recipients.find_each do |user|
      CompanyUpdateMailer.update_published(
        company_update_id: company_update.id,
        user_id: user.id
      ).deliver_now
    end
  end

  private
    def get_default_recipients(company)
      # Get active contractors
      contractor_user_ids = User.joins(:company_workers)
                               .where(company_workers: { company: company, ended_at: nil })
                               .distinct
                               .pluck(:id)

      # Get investors
      investor_user_ids = User.joins(:company_investors)
                             .where(company_investors: { company: company })
                             .distinct
                             .pluck(:id)

      # Combine and return unique users
      all_user_ids = (contractor_user_ids + investor_user_ids).uniq
      User.where(id: all_user_ids)
    end
end
