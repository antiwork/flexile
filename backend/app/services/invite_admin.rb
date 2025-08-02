# frozen_string_literal: true

class InviteAdmin
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email
    @current_user = current_user
  end

  def perform
    user = User.find_or_initialize_by(email:)
    return { success: false, field: "email", error_message: "Email has already been taken" } if user.persisted?

    company_administrator = user.company_administrators.find_or_initialize_by(company: company)
    user.invite!(current_user) { |u| u.skip_invitation = true }

    if user.errors.blank?
      CompanyAdministratorMailer.invitation_instructions(administrator_id: company_administrator.id, url: user.create_clerk_invitation).deliver_later
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
