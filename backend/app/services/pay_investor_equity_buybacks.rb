# frozen_string_literal: true

class PayInvestorEquityBuybacks < BaseWisePayoutService
  private
    attr_reader :equity_buybacks

    def initialize(company_investor, equity_buybacks)
      @equity_buybacks = equity_buybacks
      super(company_investor, equity_buybacks)
    end

    def payment_model
      EquityBuybackPayment
    end

    def item_type_name
      "Equity buyback"
    end

    def valid_statuses
      [EquityBuyback::ISSUED, EquityBuyback::RETAINED]
    end

    def issued_status
      EquityBuyback::ISSUED
    end

    def processing_status
      EquityBuyback::PROCESSING
    end

    def net_amount_in_cents
      @_net_amount_in_cents ||= equity_buybacks.sum(:total_amount_cents)
    end

    def requires_bank_account?
      false
    end

    def payment_attributes
      {
        equity_buybacks:,
        status: Payment::INITIAL,
        processor_uuid: SecureRandom.uuid,
        wise_credential: WiseCredential.flexile_credential,
        wise_recipient: bank_account,
        processor_name: EquityBuybackPayment::PROCESSOR_WISE,
      }
    end

    def failure_mailer_method
      CompanyInvestorMailer.method(:equity_buyback_payment_failed_reenter_bank_details)
    end

    def payment_id_param
      :equity_buyback_payment_id
    end

    def fee_update_attributes(wise_fee)
      { transfer_fee_cents: (wise_fee.to_d * 100).to_i }
    end

    def run_pre_payout_validations
      raise "Feature unsupported for company #{company.id}" unless company.tender_offers_enabled?
    end
end
