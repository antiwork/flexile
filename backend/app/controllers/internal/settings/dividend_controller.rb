# frozen_string_literal: true

class Internal::Settings::DividendController < Internal::Settings::BaseController
  after_action :verify_authorized

  def show
    authorize [:settings, :dividend]
    render json: Settings::DividendPresenter.new(Current.user).props
  end

  def update
    authorize [:settings, :dividend]
    user = Current.user
    if user.update(update_params)
      render json: { success: true }
    else
      render json: { success: false }
    end
  end

  private
    def update_params
      params.require(:user).permit(:minimum_dividend_payment_in_cents)
    end
end
