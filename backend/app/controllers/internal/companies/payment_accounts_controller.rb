# frozen_string_literal: true

require "securerandom"

class Internal::Companies::PaymentAccountsController < Internal::Companies::BaseController
  def balances
    authorize :payment_account, :index?

    # Get account balances from various sources
    balances = {
      stripe_balance_cents: get_stripe_balance_cents,
      wise_balance_cents: get_wise_balance_cents,
      bank_balance_cents: 0, # Bank integration not implemented yet
    }

    render json: balances
  rescue StandardError => e
    Rails.logger.error "Failed to fetch account balances for company #{current_company.id}: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
    render json: { error: "Failed to fetch account balances" }, status: :internal_server_error
  end

  def pull_funds
    authorize :payment_account, :update?

    amount_cents = params[:amount_in_cents].to_i
    raise ArgumentError, "Amount must be positive" if amount_cents <= 0

    # Initiate ACH pull from bank via Stripe
    result = initiate_stripe_ach_pull(amount_cents)

    render json: {
      success: true,
      transfer_id: result[:transfer_id],
      status: result[:status],
      amount_cents: amount_cents,
    }
  rescue ArgumentError => e
    render json: { error: e.message }, status: :bad_request
  rescue StandardError => e
    Rails.logger.error "Failed to pull funds for company #{current_company.id}, amount: #{amount_cents}: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
    render json: { error: "Failed to pull funds from bank" }, status: :internal_server_error
  end

  def transfer_to_wise
    authorize :payment_account, :update?

    amount_cents = params[:amount_in_cents].to_i
    raise ArgumentError, "Amount must be positive" if amount_cents <= 0

    # Transfer funds from Stripe to Wise
    result = initiate_wise_transfer(amount_cents)

    render json: {
      success: true,
      transfer_id: result[:transfer_id],
      status: result[:status],
      amount_cents: amount_cents,
    }
  rescue ArgumentError => e
    render json: { error: e.message }, status: :bad_request
  rescue StandardError => e
    Rails.logger.error "Failed to transfer to Wise for company #{current_company.id}, amount: #{amount_cents}: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
    render json: { error: "Failed to transfer funds to Wise" }, status: :internal_server_error
  end

  private
    def get_stripe_balance_cents
      # TODO: Replace with actual Stripe::Balance.retrieve integration
      2_500_000
    rescue StandardError => e
      Rails.logger.error "Failed to fetch Stripe balance: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
      0
    end

    def get_wise_balance_cents
      # TODO: Replace with actual Wise API balance retrieval
      0
    rescue StandardError => e
      Rails.logger.error "Failed to fetch Wise balance: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
      0
    end

    def initiate_stripe_ach_pull(amount_cents)
      # TODO: Replace with actual Stripe PaymentIntent/Transfer creation for ACH pulls

      {
        transfer_id: "mock_stripe_transfer_#{SecureRandom.hex(8)}",
        status: "pending",
      }
    rescue StandardError => e
      Rails.logger.error "Stripe ACH pull failed for amount #{amount_cents}: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
      raise e
    end

    def initiate_wise_transfer(amount_cents)
      # TODO: Replace with actual Wise transfer API integration

      {
        transfer_id: "mock_wise_transfer_#{SecureRandom.hex(8)}",
        status: "pending",
      }
    rescue StandardError => e
      Rails.logger.error "Wise transfer failed for amount #{amount_cents}: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}"
      raise e
    end
end
