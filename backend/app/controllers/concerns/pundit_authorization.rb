# frozen_string_literal: true

module PunditAuthorization
  extend ActiveSupport::Concern
  include Pundit::Authorization

  included do
    rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized

    helper_method :pundit_user
  end

  def pundit_user
    @_pundit_user ||= current_context
  end

  private
    def user_not_authorized(exception)
      Rails.logger.warn(debug_message(exception))

      render json: { success: false, error: "You are not allowed to perform this action." }, status: :forbidden
    end

    def debug_message(exception)
      if Current.user
        "Pundit::NotAuthorizedError for #{exception.policy.class} " \
        "by User ID #{pundit_user.user.id} " \
        "#{pundit_user.company.present? ? "for Company ID #{pundit_user.company.id}" : "without a company (signed up as contractor)"} " \
        ": #{exception.message}"
      else
        "Pundit::NotAuthorizedError for #{exception.policy.class} by unauthenticated user: #{exception.message}"
      end
    end
end
