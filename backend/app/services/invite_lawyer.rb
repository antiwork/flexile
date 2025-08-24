# frozen_string_literal: true

class InviteLawyer
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email
    @current_user = current_user
  end

  def perform
    user = User.find_or_initialize_by(email:)
    company_lawyer = user.company_lawyers.find_or_initialize_by(company:)
    return { success: false, field: "email", error_message: "User is already a lawyer for this company." } if company_lawyer.persisted?

    if user.persisted?
      user.invited_by = current_user
      user.save
      company_lawyer.save
    else
      user.invite!(current_user) { |u| u.skip_invitation = true }
      company_lawyer.save if user.persisted?
    end

    if user.errors.blank? && company_lawyer.errors.blank?
      CompanyLawyerMailer.invitation_instructions(lawyer_id: company_lawyer.id).deliver_later
      return { success: true }
    end

    error_object = company_lawyer.errors.any? ? company_lawyer : user
    field = error_object.errors.attribute_names.first
    message = if company_lawyer.errors.details[:user_id].any? { |e| e[:error] == :taken }
      "User is already a lawyer for this company."
    else
      error_object.errors.full_messages.to_sentence
    end
    { success: false, field: field, error_message: message }
  end

  private
    attr_reader :company, :email, :current_user
end
