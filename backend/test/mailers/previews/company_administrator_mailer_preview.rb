# frozen_string_literal: true

class CompanyAdministratorMailerPreview < ActionMailer::Preview
  def invitation_instructions
    company_administrator = CompanyAdministrator.last

    CompanyAdministratorMailer.invitation_instructions(
      admin_id: company_administrator.id
    )
  end
end
