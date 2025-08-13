# frozen_string_literal: true

class CompanyUpdateMailerPreview < ActionMailer::Preview
  def update_published
    CompanyUpdateMailer.update_published(company_update_id: CompanyUpdate.last.id, user_id: User.last.id)
  end
end
