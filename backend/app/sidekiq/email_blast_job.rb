# frozen_string_literal: true

class EmailBlastJob
  include Sidekiq::Job

  def perform
    return unless Rails.env.production?

    CompanyAdministrator.find_each do |admin|
      CompanyMailer.email_blast(admin_id: admin.id).deliver_later
    end
  end
end
