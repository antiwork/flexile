# frozen_string_literal: true

class WalletPolicy < ApplicationPolicy
  def update?
    user.restricted_payout_country_resident? && user.investor?
  end
end
