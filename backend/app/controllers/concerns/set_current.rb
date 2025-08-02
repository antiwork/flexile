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
    user = nil

    # Get JWT token from Authorization header
    auth_header = request.headers["Authorization"]
    if auth_header&.start_with?("Bearer ")
      token = auth_header.split(" ").last
      begin
        # Decode JWT token (you'll need to implement this based on your NextAuth secret)
        decoded_token = decode_jwt_token(token)
        if decoded_token
          google_id = decoded_token["sub"]
          user = User.find_by(google_id: google_id)

          if user && decoded_token["iat"]
            user.update!(current_sign_in_at: Time.zone.at(decoded_token["iat"]))
          end
        end
      rescue => e
        Rails.logger.error "JWT token decode error: #{e.message}"
      end
    end

    invited_company = nil
    if cookies["invitation_token"].present?
      invite_link = CompanyInviteLink.find_by(token: cookies["invitation_token"])
      invited_company = invite_link&.company
      user.update!(signup_invite_link: invite_link) if invite_link && user
      cookies.delete("invitation_token")
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
    def decode_jwt_token(token)
      # This is a simplified JWT decode - you should use a proper JWT library
      # and verify the signature with your NextAuth secret
      require "jwt"
      secret = GlobalConfig.get("NEXTAUTH_SECRET", "your-nextauth-secret")
      JWT.decode(token, secret, true, { algorithm: "HS256" })[0]
    rescue JWT::DecodeError
      nil
    end

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
