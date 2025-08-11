# frozen_string_literal: true

class InviteLawyer
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email.to_s.downcase
    @current_user = current_user
  end

  def perform
    company_lawyer = nil

    ActiveRecord::Base.transaction do
      user = User.find_or_create_by!(email: @email)
      company_lawyer = user.company_lawyers.create!(company: @company)
      user.invite!(@current_user) { |u| u.skip_invitation = true }
    end

    CompanyLawyerMailer.invitation_instructions(
      lawyer_id: company_lawyer.id
    ).deliver_later(queue: "mailers", wait: 3.seconds)

    { success: true }
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
    if e.message.include?("company_lawyers") || e.record&.class == CompanyLawyer
      {
        success: false,
        field: :email,
        error_message: "Lawyer account already exists for this email",
      }
    else
      {
        success: false,
        field: e.record&.errors&.first&.attribute || :base,
        error_message: e.record&.errors&.full_messages&.first || e.message,
      }
    end
  end
end
