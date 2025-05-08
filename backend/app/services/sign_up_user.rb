# frozen_string_literal: true

class SignUpUser
  def initialize(user_attributes:, ip_address:)
    @user_attributes = user_attributes
    @ip_address = ip_address
  end

  def perform
    ApplicationRecord.transaction do
      user = User.create!(user_attributes)
      user.tos_agreements.create!(ip_address:)
      { success: true, user: }
    end
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    attr_reader :user_attributes, :ip_address
end
