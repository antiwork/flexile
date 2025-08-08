# frozen_string_literal: true

class CompanyAdministratorMailerPreview < ActionMailer::Preview
  def invitation_instructions
    company_administrator = CompanyAdministrator.last
    CompanyAdministratorMailer.invitation_instructions(
      administrator_id: company_administrator.id,
      url: "https://example.com/signup"
    )
  end
end
