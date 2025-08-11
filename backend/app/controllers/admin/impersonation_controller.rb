# frozen_string_literal: true

class Admin::ImpersonationController < Admin::ApplicationController
  def create
    token = params[:token]
    return redirect_to admin_root_path, alert: "Invalid impersonation token" if token.blank?

    begin
      user_id = GlobalID::Locator.locate_signed(token, purpose: :impersonate)&.id
      user = User.find_by(id: user_id) if user_id
    rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveSupport::MessageExpired
      return redirect_to admin_root_path, alert: "Invalid or expired impersonation token"
    end

    return redirect_to admin_root_path, alert: "User not found" unless user

    session[:impersonator_id] = Current.user.id
    session[:impersonated_user_id] = user.id
    Current.user = user

    jwt_token = JwtService.generate_token(user)
    cookies[:auth_token] = {
      value: jwt_token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :lax
    }

    redirect_to admin_root_path, notice: "Now impersonating #{user.display_name}"
  end

  def destroy
    impersonator_id = session[:impersonator_id]
    return redirect_to admin_root_path, alert: "No active impersonation" unless impersonator_id

    impersonator = User.find_by(id: impersonator_id)
    return redirect_to admin_root_path, alert: "Original user not found" unless impersonator

    session.delete(:impersonator_id)
    session.delete(:impersonated_user_id)
    Current.user = impersonator

    jwt_token = JwtService.generate_token(impersonator)
    cookies[:auth_token] = {
      value: jwt_token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :lax
    }

    redirect_to admin_root_path, notice: "Stopped impersonating, back to #{impersonator.display_name}"
  end
end