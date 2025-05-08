# frozen_string_literal: true

class DeviseMailerPreview < ActionMailer::Preview
  def confirmation_instructions
    DeviseMailer.confirmation_instructions(User.last, {})
  end

  def email_changed
    user = User.last
    user.unconfirmed_email = "new+email@example.com"
    DeviseMailer.email_changed(User.last, {})
  end

  def contractor_invitation_instructions
    company = Company.last
    inviter = company.primary_admin.user
    invitee = company.company_workers.first.user
    invitee.invited_by = inviter
    DeviseMailer.invitation_instructions(invitee, "SomeInvitationToken", {
      subject: "You're invited to #{company.name}'s team",
      reply_to: company.email,
    })
  end

  def project_based_contractor_invitation_instructions
    company_worker = CompanyWorker.project_based.first
    company = company_worker.company
    inviter = company.primary_admin.user
    invitee = company_worker.user
    invitee.invited_by = inviter
    DeviseMailer.invitation_instructions(invitee, "SomeInvitationToken", {
      subject: "You're invited to #{company.name}'s team",
      reply_to: company.email,
    })
  end

  def investor_invitation_instructions
    investor = CompanyInvestor.last
    company = investor.company
    invitee = investor.user
    inviter = company.primary_admin.user
    invitee.invited_by = inviter
    DeviseMailer.invitation_instructions(invitee, invitee.invitation_token, {
      subject: "Action required: start earning distributions on your investment in #{company.name}",
      reply_to: inviter.email,
      template_name: "investor_invitation_instructions",
      dividend_date: 21.days.from_now.to_date,
    })
  end

  def password_change
    DeviseMailer.password_change(User.last, {})
  end

  def reset_password_instructions
    user = User.last
    token = user.send(:set_reset_password_token)
    DeviseMailer.reset_password_instructions(user, token, {})
  end
end
