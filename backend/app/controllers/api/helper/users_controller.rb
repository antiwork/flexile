# frozen_string_literal: true

class Api::Helper::UsersController < Api::Helper::BaseController
  before_action :require_email!

  def show
    render json: { success: true, customer: HelperUserInfoService.new(email: params[:email]).customer_info }
  end

  def require_email!
    if params[:email].blank?
      render json: { success: false, error: "'email' parameter is required" }, status: :bad_request
    end
  end
end
