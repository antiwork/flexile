# frozen_string_literal: true

class Api::Helper::BaseController < Api::BaseController
  skip_before_action :verify_api_token
  skip_before_action :authenticate_with_jwt
  before_action :authorize!

  HMAC_EXPIRATION = 1.minute

  private
    def authorize!
      return render json: { success: false }, status: :unauthorized if request.authorization.nil?
      if params[:timestamp].blank?
        return render json: { success: false, error: "`timestamp` is required" }, status: :bad_request
      end

      hmac = Base64.decode64(request.authorization.split(" ").last)
      expected_hmac = OpenSSL::HMAC.digest(OpenSSL::Digest.new("sha256"),
                                           GlobalConfig.dig("helper", "secret_key"),
                                           request.query_string)
      unless ActiveSupport::SecurityUtils.secure_compare(expected_hmac, hmac)
        return render json: { success: false, message: "Authorization is invalid" }, status: :unauthorized
      end

      if params[:timestamp].to_i < HMAC_EXPIRATION.ago.to_i
        render json: { success: false, message: "Authorization expired" }, status: :unauthorized
      end
    end
end
