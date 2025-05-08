# frozen_string_literal: true

class WiseBalanceUpdateJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform
    Wise::AccountBalance.refresh_flexile_balance
  end
end
