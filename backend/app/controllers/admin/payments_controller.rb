# frozen_string_literal: true

module Admin
  class PaymentsController < Admin::ApplicationController
    WISE_SANDBOX_URL = "https://api.sandbox.transferwise.tech"

    def wise_charged_back
      transfer_id = requested_resource.wise_transfer_id
      HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/processing",
                   headers: {
                     "Authorization" => "Bearer #{WISE_API_KEY}",
                   })

      HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/charged_back",
                   headers: {
                     "Authorization" => "Bearer #{WISE_API_KEY}",
                   })

      redirect_to(
        after_resource_updated_path(requested_resource),
        notice: "Done",
      )
    end

    def wise_paid
      send_payment(requested_resource.wise_transfer_id)

      redirect_to(
        after_resource_updated_path(requested_resource),
        notice: "Done",
      )
    end

    def wise_funds_refunded
      transfer_id = requested_resource.wise_transfer_id

      send_payment(transfer_id)
      HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/bounced_back",
                   headers: {
                     "Authorization" => "Bearer #{WISE_API_KEY}",
                   })
      HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/funds_refunded",
                   headers: {
                     "Authorization" => "Bearer #{WISE_API_KEY}",
                   })

      redirect_to(
        after_resource_updated_path(requested_resource),
        notice: "Done",
      )
    end

    private
      def send_payment(transfer_id)
        HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/processing",
                     headers: {
                       "Authorization" => "Bearer #{WISE_API_KEY}",
                     })
        HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/funds_converted",
                     headers: {
                       "Authorization" => "Bearer #{WISE_API_KEY}",
                     })
        HTTParty.get("#{WISE_SANDBOX_URL}/v1/simulation/transfers/#{transfer_id}/outgoing_payment_sent",
                     headers: {
                       "Authorization" => "Bearer #{WISE_API_KEY}",
                     })
      end
  end
end
