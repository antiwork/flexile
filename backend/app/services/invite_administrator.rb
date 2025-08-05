# frozen_string_literal: true

class InviteAdministrator
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email.to_s.downcase
    @current_user = current_user
  end

  def perform
    company_admin = nil

    ActiveRecord::Base.transaction do
      user = User.find_or_create_by!(email: @email)
      company_admin = user.company_administrators.create!(company: @company)
      user.invite!(@current_user) { |u| u.skip_invitation = true }
    end

    CompanyAdministratorMailer.invitation_instructions(
      admin_id: company_admin.id
    ).deliver_later(queue: "mailers", wait: 3.seconds)

    { success: true }
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
    if e.message.include?("company_administrators") || e.record&.class == CompanyAdministrator
      {
        success: false,
        field: :email,
        error_message: "Administrator account already exists for this email",
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
