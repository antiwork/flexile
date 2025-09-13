# frozen_string_literal: true

module Admin
  class ImpersonationController < Admin::ApplicationController
    def create
      user = User.find_by(email: params[:email])
      return render json: { error_message: "User not found" }, status: :not_found unless user
      return render json: { error_message: "Nice try, but you can't impersonate yourself!" }, status: :unprocessable_entity if user == Current.user

      authorize user, policy_class: ImpersonationPolicy
      render json: { redirect_url: user.generate_impersonation_url }, status: :created
    end
  end
end
