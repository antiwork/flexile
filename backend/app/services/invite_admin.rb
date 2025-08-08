# frozen_string_literal: true

class InviteAdmin
  def initialize(company:, email:, current_user:)
    @company = company
    @user = User.find_or_initialize_by(email: email)
    @current_user = current_user
  end

  def perform
    company_admin = @user.company_administrators.find_or_initialize_by(company: @company)
    return { success: false, field: "email", error_message: "User is already an administrator for this company." } if company_admin.persisted?

    if @user.persisted?
      @user.invited_by = @current_user
      @user.save
      company_admin.save
    else
      @user.invite!(@current_user) { |u| u.skip_invitation = true }
      company_admin.save if @user.persisted?
    end

    if @user.errors.blank? && company_admin.errors.blank?
      CompanyAdministratorMailer.invitation_instructions(administrator_id: company_admin.id, url: SIGNUP_URL).deliver_later
      return { success: true }
    end

    error_object = company_admin.errors.any? ? company_admin : @user
    field = error_object.errors.attribute_names.first
    message = if company_admin.errors.details[:user_id].any? { |e| e[:error] == :taken }
      "User is already an administrator for this company."
    else
      error_object.errors.full_messages.to_sentence
    end
    { success: false, field: field, error_message: message }
  end
end
