# frozen_string_literal: true

class CompanyLawyerMailerPreview < ActionMailer::Preview
  def invitation_instructions
    company_lawyer = CompanyLawyer.last
    CompanyLawyerMailer.invitation_instructions(lawyer_id: company_lawyer.id, token: "SomeInvitationToken")
  end
end
