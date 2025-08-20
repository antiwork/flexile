# frozen_string_literal: true

class Admin::ImpersonationController < Admin::ApplicationController
  skip_before_action :verify_authenticity_token
  def create
    token = params[:token]

    if token.blank?
      return render json: { error: "Invalid impersonation token" }, status: :bad_request
    end

    begin
      # This will raise InvalidSignature for invalid tokens
      located = GlobalID::Locator.locate_signed(token, purpose: :impersonate)

      if located.nil?
        # Token is expired or invalid format
        return render json: { error: "Invalid or expired impersonation token" }, status: :unauthorized
      end

      user = located
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      # Token signature is invalid
      return render json: { error: "Invalid or expired impersonation token" }, status: :unauthorized
    rescue => e
      Rails.logger.error "Impersonation error: #{e.class}: #{e.message}"
      return render json: { error: "Invalid or expired impersonation token" }, status: :unauthorized
    end

    unless user
      return render json: { error: "User not found" }, status: :not_found
    end

    # TODO (techdebt): Replace with proper audit event
    admin = Current.user
    Rails.logger.info(
      message: "Admin impersonation started",
      admin_id: admin&.id,
      admin_email: admin&.email,
      target_user_id: user.id,
      target_user_email: user.email
    )

    jwt_token = JwtService.generate_token(
      user,
      exp: 15.minutes.from_now,
      extra_claims: {
        imp: true,
        act: Current.user&.id,
      }
    )

    redirect_url = if user.administrator?
                     "/invoices"
                   elsif user.lawyer?
                     "/documents"
                   elsif user.worker?
                     "/invoices"
                   else
                     "/equity"
                   end

    render json: {
      token: jwt_token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
      redirect_url: redirect_url,
    }, status: :ok
  end
end
