# frozen_string_literal: true

module SetCurrent
  extend ActiveSupport::Concern

  included do
    helper_method :current_context

    before_action :current_context
  end

  def current_context
    @current_context ||= set_current
  end

  def set_current
    if clerk&.user_id
      user = User.find_by(clerk_id: clerk.user_id)
      if !user && !Rails.env.test?
        email = clerk.user.email_addresses.find { |item| item.id == clerk.user.primary_email_address_id }.email_address
        user = User.find_by(email:) if Rails.env.development?
        if user
          user.update!(clerk_id: clerk.user_id)
        else
          user = User.create!(clerk_id: clerk.user_id, email:)
          user.tos_agreements.create!(ip_address: request.remote_ip)
        end
      end

      if clerk.user? && clerk.session_claims["iat"] != user.current_sign_in_at.to_i
        user.update!(current_sign_in_at: Time.zone.at(clerk.session_claims["iat"]))
      end

      invited_company = nil
      if cookies["invitation_token"].present?
        invite_link = CompanyInviteLink.find_by(token: cookies["invitation_token"])
        invited_company = invite_link&.company
        user.update!(signup_invite_link: invite_link) if invite_link
        cookies.delete("invitation_token")
      end
    end

    Current.user = user

    if Current.user.present?
      company = invited_company || company_from_param || company_from_user
      if company.nil?
        ApplicationRecord.transaction do
          company = user.all_companies.first
          if company.nil?
            company = Company.create!(
              email: user.email,
              country_code: user.country_code || "US",
              default_currency: "USD"
            )
            user.company_administrators.create!(company: company)
            user.company_administrators.reload
            user.companies.reload
          end
        end
      end
      cookies.permanent[current_user_selected_company_cookie_name] = company.external_id if company.present?
    end
    Current.company = company

    context = CurrentContext.new(user: Current.user, company:)
    Current.company_administrator = context.company_administrator
    Current.company_worker = context.company_worker
    Current.company_investor = context.company_investor
    Current.company_lawyer = context.company_lawyer
    context
  end

  private
    def company_from_param
      # TODO: Remove params[:companyId] once all URLs are updated
      company_id = params[:company_id] || params[:companyId] || cookies[current_user_selected_company_cookie_name]
      return if company_id.blank? || company_id == Company::PLACEHOLDER_COMPANY_ID

      company = Current.user.all_companies.find { _1.external_id == company_id }
      # Ensures the URL contains a valid company ID that the user can access
      return e404 if company.blank?

      company
    end

    def company_from_user
      Company::ACCESS_ROLES.each do |access_role, model_class|
        next unless Current.user.public_send(:"#{access_role}?")

        return model_class.where(user_id: Current.user.id).first!.company
      end

      nil
    end

    def reset_current
      @current_context = nil
      current_context
    end

    def current_user_selected_company_cookie_name
      [Current.user.external_id, "selected_company"].join("_")
    end
end
