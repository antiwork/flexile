# frozen_string_literal: true

FactoryBot.define do
  factory :equity_buyback_payment do
    equity_buybacks { [create(:equity_buyback)] }
    wise_credential
    wise_recipient
    status { Payments::Status::INITIAL }
    processor_name { EquityBuybackPayment::PROCESSOR_WISE }
  end
end
