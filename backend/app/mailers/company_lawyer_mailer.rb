# frozen_string_literal: true

class CompanyLawyerMailer < ApplicationMailer
  def invitation_instructions(lawyer_id:)
    company_lawyer = CompanyLawyer.find_by(id: lawyer_id)
    return unless company_lawyer

    user = company_lawyer.user
    @company = company_lawyer.company
    @url = SIGNUP_URL

    mail(
      to: user.email,
      subject: "You've been invited to join #{@company.name} as a lawyer",
      reply_to: @company.email
    )
  end
end
