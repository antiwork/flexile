# frozen_string_literal: true

class Internal::Settings::BankAccountsController < Internal::Settings::BaseController
  after_action :verify_authorized
  before_action :authenticate_user_json!
  before_action :load_bank_account!, only: [:update]

  def index
    authorize :bank_account
    render json: Settings::BankAccountsPresenter.new(Current.user).props
  end

  def create
    authorize :bank_account

    recipient_service = Recipient::CreateService.new(
      user: Current.user,
      params: params.require(:recipient).permit(:currency, :type, details: {}).to_h,
      replace_recipient_id: params[:replace_recipient_id].presence
    )
    render json: recipient_service.process
  end

  def update
    authorize :bank_account
    user = Current.user
    ApplicationRecord.transaction do
      if bank_account_params[:used_for_invoices]
        user.bank_account&.update!(used_for_invoices: false)
        @bank_account.update!(used_for_invoices: true)
      end
      if bank_account_params[:used_for_dividends]
        user.bank_account_for_dividends&.update!(used_for_dividends: false)
        @bank_account.update!(used_for_dividends: true)
      end
    end
  rescue => e
    Bugsnag.notify(e)
    render json: { success: false }, status: :unprocessable_entity
  else
    render json: { success: true }
  end

  private
    def load_bank_account!
      @bank_account = Current.user.bank_accounts.alive.find_by(id: params[:id])
      e404 unless @bank_account.present?
    end

    def bank_account_params
      params.require(:bank_account).permit(:used_for_invoices, :used_for_dividends)
    end
end
