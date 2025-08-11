# frozen_string_literal: true

class Internal::OauthController < Internal::BaseController
  skip_before_action :authenticate_internal_user!, only: [:github_login, :github_signup]

  def github_login
    oauth_params = params.require(:oauth).permit(:email, :github_uid, :invitation_token)

    user = User.find_by(email: oauth_params[:email])

    if user.blank?
      render json: { error: "No account found with this email address. Please sign up first." }, status: :not_found
      return
    end

    # Update the user's GitHub UID if not already set
    if user.github_uid.blank?
      user.update!(github_uid: oauth_params[:github_uid])
    elsif user.github_uid != oauth_params[:github_uid]
      render json: { error: "GitHub account mismatch. Please contact support." }, status: :unauthorized
      return
    end

    # Update last sign in timestamp
    user.update!(current_sign_in_at: Time.current)

    # Generate JWT token
    jwt_token = JwtService.encode(user_id: user.id)

    render json: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        legal_name: user.legal_name,
        preferred_name: user.preferred_name,
      },
      jwt: jwt_token,
    }
  end

  def github_signup
    oauth_params = params.require(:oauth).permit(:email, :github_uid, :invitation_token)

    # Check if user already exists
    existing_user = User.find_by(email: oauth_params[:email])
    if existing_user.present?
      render json: { error: "Account already exists with this email. Please log in instead." }, status: :conflict
      return
    end

    # Check for invitation link if provided
    invite_link = nil
    if oauth_params[:invitation_token].present?
      invite_link = CompanyInviteLink.find_by(token: oauth_params[:invitation_token])
      if invite_link.blank?
        render json: { error: "Invalid invitation token." }, status: :not_found
        return
      end
    end

    # Create new user
    user = User.new(
      email: oauth_params[:email],
      github_uid: oauth_params[:github_uid],
      signup_invite_link: invite_link,
      current_sign_in_at: Time.current
    )

    if user.save
      # Create TOS agreement
      user.tos_agreements.create!(
        ip_address: request.remote_ip,
        user_agent: request.user_agent,
        agreed_at: Time.current
      )

      # If no invite link, create a company for the user
      if invite_link.blank?
        company = Company.create!(name: "#{user.email}'s Company")
        company.company_administrators.create!(user: user)
      end

      # Generate JWT token
      jwt_token = JwtService.encode(user_id: user.id)

      render json: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          legal_name: user.legal_name,
          preferred_name: user.preferred_name,
        },
        jwt: jwt_token,
      }
    else
      render json: { error: user.errors.full_messages.first }, status: :unprocessable_entity
    end
  end
end
