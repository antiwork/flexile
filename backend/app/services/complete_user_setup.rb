# frozen_string_literal: true

class CompleteUserSetup
  def initialize(user:, ip_address:)
    @user = user
    @ip_address = ip_address
  end

  def perform
    user.tos_agreements.create!(ip_address: ip_address)
  end

  private
    attr_reader :user, :ip_address
end
