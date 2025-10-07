# frozen_string_literal: true

module Api
  class ImpersonationController < ApplicationController
    include JwtAuthenticatable

    # POST /api/impersonation/start
    # Start impersonation session using URL token
    def start
      token = params[:token]

      unless token
        return render json: { error: "Token is required" }, status: :bad_request
      end

      user = ImpersonationService.validate_impersonation_url_token(token)
      unless user
        return render json: { error: "Invalid or expired token" }, status: :unauthorized
      end

      # Verify the requesting user is an admin (from JWT auth)
      unless Current.user&.team_member?
        return render json: { error: "Admin access required" }, status: :forbidden
      end

      # Generate impersonation session token
      session_token = ImpersonationService.generate_impersonation_session_token(user, Current.user)

      render json: {
        impersonation_token: session_token,
        impersonated_user: {
          id: user.external_id,
          email: user.email,
          name: user.display_name,
        },
        admin_user: {
          id: Current.user.external_id,
          email: Current.user.email,
          name: Current.user.display_name,
        },
        expires_at: ImpersonationService::IMPERSONATION_SESSION_EXPIRY.from_now.iso8601,
      }
    end

    # POST /api/impersonation/stop
    # Stop impersonation session
    def stop
      unless Current.impersonating?
        return render json: { error: "Not currently impersonating" }, status: :bad_request
      end

      render json: { message: "Impersonation stopped successfully" }
    end

    # GET /api/impersonation/status
    # Get current impersonation status
    def status
      if Current.impersonating?
        render json: {
          impersonating: true,
          impersonated_user: {
            id: Current.user.external_id,
            email: Current.user.email,
            name: Current.user.display_name,
          },
          admin_user: {
            id: Current.admin_user.external_id,
            email: Current.admin_user.email,
            name: Current.admin_user.display_name,
          },
        }
      else
        render json: { impersonating: false }
      end
    end

    # POST /api/impersonation/generate_url
    # Generate impersonation URL for a user (admin only)
    def generate_url
      unless Current.user&.team_member?
        return render json: { error: "Admin access required" }, status: :forbidden
      end

      user_id = params[:user_id]
      unless user_id
        return render json: { error: "User ID is required" }, status: :bad_request
      end

      user = User.find_by(external_id: user_id)
      unless user
        return render json: { error: "User not found" }, status: :not_found
      end

      token = ImpersonationService.generate_impersonation_url_token(user)
      base_url = request.base_url
      impersonation_url = "#{base_url}/impersonate?token=#{token}"

      render json: {
        impersonation_url: impersonation_url,
        token: token,
        expires_at: ImpersonationService::IMPERSONATION_URL_TOKEN_EXPIRY.from_now.iso8601,
        user: {
          id: user.external_id,
          email: user.email,
          name: user.display_name,
        },
      }
    end
  end
end
