# frozen_string_literal: true

class Internal::Companies::PaymentAccountsController < Internal::Companies::BaseController
  def balances
    authorize :payment_account, :index?

    # Get account balances from various sources
    balances = {
      stripe_balance_cents: get_stripe_balance_cents,
      wise_balance_cents: get_wise_balance_cents,
      bank_balance_cents: 0, # Would need bank API integration
    }

    render json: balances
  rescue StandardError => e
    Rails.logger.error "Failed to fetch account balances: #{e.message}"
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
    Rails.logger.error "Failed to pull funds: #{e.message}"
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
    Rails.logger.error "Failed to transfer to Wise: #{e.message}"
    render json: { error: "Failed to transfer funds to Wise" }, status: :internal_server_error
  end

  private

  def get_stripe_balance_cents
    # Mock implementation - replace with actual Stripe API call
    # In real implementation: Stripe::Balance.retrieve(stripe_account: company.stripe_account_id)
    2500000 # $25,000
  rescue StandardError => e
    Rails.logger.error "Failed to fetch Stripe balance: #{e.message}"
    0
  end

  def get_wise_balance_cents
    # Mock implementation - replace with actual Wise API call
    # In real implementation: Wise::AccountBalance.get_balance(account_id: company.wise_account_id)
    0
  rescue StandardError => e
    Rails.logger.error "Failed to fetch Wise balance: #{e.message}"
    0
  end

  def initiate_stripe_ach_pull(amount_cents)
    # Mock implementation - replace with actual Stripe ACH pull
    # In real implementation:
    # transfer = Stripe::Transfer.create({
    #   amount: amount_cents,
    #   currency: 'usd',
    #   destination: company.stripe_account_id,
    #   description: "ACH pull for dividend funding"
    # })
    
    {
      transfer_id: "mock_stripe_transfer_#{SecureRandom.hex(8)}",
      status: "pending",
    }
  rescue StandardError => e
    Rails.logger.error "Stripe ACH pull failed: #{e.message}"
    raise e
  end

  def initiate_wise_transfer(amount_cents)
    # Mock implementation - replace with actual Wise API integration
    # In real implementation:
    # Use Wise API to transfer funds from Stripe account to Wise balance
    
    {
      transfer_id: "mock_wise_transfer_#{SecureRandom.hex(8)}",
      status: "pending",
    }
  rescue StandardError => e
    Rails.logger.error "Wise transfer failed: #{e.message}"
    raise e
  end
end