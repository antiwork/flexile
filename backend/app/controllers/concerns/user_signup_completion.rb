# frozen_string_literal: true

module UserSignupCompletion
  extend ActiveSupport::Concern

  private
    def complete_user_signup(user)
      ApplicationRecord.transaction do
        now = Time.current
        user.confirmed_at = now
        user.current_sign_in_at = now
        user.invitation_accepted_at = now
        user.save!

        user.tos_agreements.create!(ip_address: request.remote_ip)

        user
      end
    end
end
