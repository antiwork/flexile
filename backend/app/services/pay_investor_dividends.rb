# frozen_string_literal: true

class PayInvestorDividends < BaseWisePayoutService
  private
    attr_reader :dividends

    def initialize(company_investor, dividends)
      @dividends = dividends
      super(company_investor, dividends)
    end

    def payment_model
      DividendPayment
    end

    def item_type_name
      "Dividend"
    end

    def valid_statuses
      [Dividend::ISSUED, Dividend::RETAINED]
    end

    def issued_status
      Dividend::ISSUED
    end

    def processing_status
      Dividend::PROCESSING
    end

    def net_amount_in_cents
      @_net_amount_in_cents ||= dividends.sum(:net_amount_in_cents)
    end

    def payment_attributes
      {
        dividends:,
        status: Payment::INITIAL,
        processor_uuid: SecureRandom.uuid,
        wise_credential: WiseCredential.flexile_credential,
        wise_recipient: bank_account,
        processor_name: DividendPayment::PROCESSOR_WISE,
      }
    end

    def failure_mailer_method
      CompanyInvestorMailer.method(:dividend_payment_failed_reenter_bank_details)
    end

    def payment_id_param
      :dividend_payment_id
    end

    def fee_update_attributes(wise_fee)
      { transfer_fee_in_cents: (wise_fee.to_d * 100).to_i }
    end

    def additional_validations
      if net_amount_in_cents < user.minimum_dividend_payment_in_cents
        dividends.each { _1.mark_retained!("below_minimum_payment_threshold") }
        return false
      end
      true
    end
end
