# frozen_string_literal: true

class Internal::Admin::ImpersonateController < Internal::BaseController
  include JwtAuthenticatable, UserDataSerialization

  def create
    return render_unauthorized unless current_user_is_admin?
    
    target_email = params[:email]
    return render_bad_request("Email is required") if target_email.blank?

    target_user = User.find_by(email: target_email)
    return render_not_found("User not found") unless target_user

    # Prevent impersonating other admins
    return render_forbidden("Cannot impersonate administrators") if target_user_is_admin?(target_user)
    
    # Prevent self-impersonation
    return render_forbidden("Cannot impersonate yourself") if target_user == Current.user

    # Ensure target user belongs to at least one company that the admin administers
    return render_forbidden("User is not in your administered companies") unless can_impersonate_user?(target_user)

    # Generate JWT for the target user but include impersonation metadata
    jwt_token = generate_impersonation_jwt(target_user, Current.user)
    
    render json: {
      jwt: jwt_token,
      user: user_data(target_user),
      impersonated_by: {
        id: Current.user.external_id,
        email: Current.user.email,
        name: Current.user.legal_name || Current.user.preferred_name || Current.user.email
      }
    }
  end

  private

  def current_user_is_admin?
    Current.user&.company_administrators&.any?
  end

  def target_user_is_admin?(user)
    user.company_administrators.any?
  end

  def can_impersonate_user?(target_user)
    # Get all companies that the current user administers
    admin_company_ids = Current.user.company_administrators.pluck(:company_id)
    
    # Check if target user belongs to any of those companies
    target_user_company_ids = [
      target_user.company_administrators.pluck(:company_id),
      target_user.company_workers.pluck(:company_id),
      target_user.company_investors.pluck(:company_id),
      target_user.company_lawyers.pluck(:company_id)
    ].flatten.uniq

    (admin_company_ids & target_user_company_ids).any?
  end

  def generate_impersonation_jwt(target_user, admin_user)
    # Use the existing JWT service but we could extend it for impersonation
    # For now, we'll use the standard JWT generation
    generate_jwt_token(target_user)
  end

  def render_bad_request(message)
    render json: { error: message }, status: :bad_request
  end

  def render_not_found(message)
    render json: { error: message }, status: :not_found
  end

  def render_forbidden(message)
    render json: { error: message }, status: :forbidden
  end
end