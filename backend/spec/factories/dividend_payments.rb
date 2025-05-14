# frozen_string_literal: true

FactoryBot.define do
  factory :dividend_payment do
    dividends { [create(:dividend)] }
    wise_credential
    wise_recipient
    status { Payments::Status::INITIAL }
    processor_name { DividendPayment::PROCESSOR_WISE }
  end
end
