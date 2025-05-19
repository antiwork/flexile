# frozen_string_literal: true

class CompanyWorkerReminderEmailService
  def confirm_tax_info_reminder(tax_year:)
    CompanyWorker.with_required_tax_info_for(tax_year:).find_each do |contractor|
      CompanyWorkerMailer.confirm_tax_info_reminder(company_worker_id: contractor.id, tax_year:).deliver_later
    end
  end
end
