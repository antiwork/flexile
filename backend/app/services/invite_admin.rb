# frozen_string_literal: true

class InviteAdmin
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email
    @current_user = current_user
  end

  def perform
    user = User.find_or_initialize_by(email: email)
    is_existing_user = user.persisted?

    if is_existing_user
      existing_company_administrator = user.company_administrators.find_by(company: company)
      if existing_company_administrator.present?
        return { success: false, field: "email", error_message: "User is already an administrator for this company." }
      end
    end

    company_administrator = user.company_administrators.find_or_initialize_by(company: company)

    if is_existing_user
      user.invited_by = current_user
      user.save && company_administrator.save
    else
      user.invite!(current_user) { |u| u.skip_invitation = true }
    end

    if user.errors.blank? && company_administrator.errors.blank?
      company_administrator.save! unless company_administrator.persisted?
      CompanyAdministratorMailer.invitation_instructions(administrator_id: company_administrator.id, url: SIGNUP_URL).deliver_later
      { success: true }
    else
      error_object = if company_administrator.errors.any?
        company_administrator
      else
        user
      end
      { success: false, field: error_object.errors.first.attribute, error_message: error_object.errors.first.full_message }
    end
  end

  private
    attr_reader :company, :email, :current_user
end
