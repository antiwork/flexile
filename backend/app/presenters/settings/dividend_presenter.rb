# frozen_string_literal: true

class Settings::DividendPresenter
  delegate :minimum_dividend_payment_in_cents, private: true, to: :user

  def initialize(user)
    @user = user
  end

  def props
    {
      minimum_dividend_payment_in_cents:,
      max_minimum_dividend_payment_in_cents: User::MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS,
      min_minimum_dividend_payment_in_cents: User::MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS,
    }
  end

  private
    attr_reader :user
end
