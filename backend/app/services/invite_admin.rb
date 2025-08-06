# frozen_string_literal: true

class InviteAdmin
  def initialize(company:, email:, current_user:)
    @company = company
    @user = User.find_or_initialize_by(email: email)
    @current_user = current_user
  end

  def perform
    if @user.persisted? && @user.company_administrators.exists?(company: @company)
      return error_response("User is already an administrator for this company.", "email")
    end

    company_admin = @user.company_administrators.find_or_initialize_by(company: @company)

    if @user.persisted?
      @user.invited_by = @current_user
      @user.save
      company_admin.save
    else
      @user.invite!(@current_user) { |u| u.skip_invitation = true }
      company_admin.save if @user.persisted?
    end

    return success_response(company_admin) if @user.errors.blank? && company_admin.errors.blank?

    error_object = company_admin.errors.any? ? company_admin : @user
    field = error_object.errors.attribute_names.first
    message = if company_admin.errors.details[:user_id].any? { |e| e[:error] == :taken }
      "User is already an administrator for this company."
    else
      error_object.errors.full_messages.to_sentence
    end
    error_response(message, field)
  end

  private
    def success_response(company_admin)
      CompanyAdministratorMailer.invitation_instructions(administrator_id: company_admin.id, url: SIGNUP_URL).deliver_later
      { success: true }
    end

    def error_response(message, field)
      { success: false, field: field, error_message: message }
    end
end
