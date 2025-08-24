# frozen_string_literal: true

class InviteLawyer
  def initialize(company:, email:, current_user:)
    @company = company
    @email = email.to_s.downcase.strip
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
    ).deliver_later(queue: "mailers")

    { success: true }
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
    {
      success: false,
      field: e.record&.errors&.attribute_names&.first,
      error_message: e.message.include?("company_lawyers") || e.record&.class == CompanyLawyer ? "Lawyer account already exists for this email" : (e.record&.errors&.full_messages&.first || e.message),
    }
  rescue StandardError => e
    Rails.logger.error "InviteLawyer failed: #{e.class} - #{e.message}"
    {
      success: false,
      field: :email,
      error_message: "An unexpected error occured, raise an email to #{SUPPORT_EMAIL} with a screenshot",
    }
  end
end
