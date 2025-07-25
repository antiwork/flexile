# frozen_string_literal: true

class Internal::Settings::BankAccountsController < Internal::Settings::BaseController
  before_action :authenticate_user_json!
  before_action :load_bank_account!, only: [:update]
  before_action :prevent_sanctioned_country_access!, only: [:create]

  after_action :verify_authorized

  def index
    authorize [:settings, :bank_account]
    render json: Settings::BankAccountsPresenter.new(Current.user).props
  end

  def create
    authorize [:settings, :bank_account]
    recipient_service = Recipient::CreateService.new(
      user: Current.user,
      params: params_for_create.to_h,
      replace_recipient_id: params[:replace_recipient_id].presence
    )
    render json: recipient_service.process
  end

  def update
    authorize [:settings, :bank_account]
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

    def prevent_sanctioned_country_access!
      if Current.user.sanctioned_country_resident?
        render json: {
          success: false,
          error: "Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform."
        }, status: :forbidden
      end
    end

    def bank_account_params
      params.require(:bank_account).permit(:used_for_invoices, :used_for_dividends)
    end

    def params_for_create
      params.require(:recipient).permit(:currency, :type, details: {})
    end
end
