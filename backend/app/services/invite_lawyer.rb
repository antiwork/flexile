# frozen_string_literal: true

class InviteLawyer
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email
    @current_user = current_user
  end

  def perform
    user = User.find_or_initialize_by(email:)
    return { success: false, field: "email", error_message: "Email has already been taken" } if user.persisted?

    company_lawyer = user.company_lawyers.find_or_initialize_by(company: company)
    user.invite!(current_user) { |u| u.skip_invitation = true }

    if user.errors.blank?
      CompanyLawyerMailer.invitation_instructions(lawyer_id: company_lawyer.id, url: SIGNUP_URL).deliver_later
      { success: true }
    else
      error_object = if company_lawyer.errors.any?
        company_lawyer
      else
        user
      end
      { success: false, field: error_object.errors.first.attribute, error_message: error_object.errors.first.full_message }
    end
  end

  private
    attr_reader :company, :email, :current_user
end
