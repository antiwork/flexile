# frozen_string_literal: true

class CompanyLawyerMailer < ApplicationMailer
  def invitation_instructions(lawyer_id:, url:)
    company_lawyer = CompanyLawyer.find(lawyer_id)
    user = company_lawyer.user
    @company = company_lawyer.company
    @url = url

    mail(
      to: user.email,
      subject: "You've been invited to join #{@company.name} as a lawyer",
      reply_to: @company.email
    )
  end
end
