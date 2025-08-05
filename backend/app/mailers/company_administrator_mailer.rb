# frozen_string_literal: true

class CompanyAdministratorMailer < ApplicationMailer
  def invitation_instructions(admin_id:)
    company_administrator = CompanyAdministrator.find_by(id: admin_id)
    return unless company_administrator

    user = company_administrator.user
    @company = company_administrator.company
    @url = SIGNUP_URL

    mail(
      to: user.email,
      subject: "You've been invited to join #{@company.name} as an administrator",
      reply_to: @company.email
    )
  end
end
