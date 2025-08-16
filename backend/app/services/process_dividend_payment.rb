# frozen_string_literal: true

class ProcessDividendPayment
  class Error < StandardError; end

  def initialize(dividend_round)
    @dividend_round = dividend_round
    @company = dividend_round.company
  end

  def process!
    validate_prerequisites!

    # Step 1: Create consolidated invoice for dividend funding
    consolidated_invoice = create_dividend_consolidated_invoice

    # Step 2: Pull money from company to cover dividend amount + fees
    total_amount_with_fees = calculate_total_amount_with_fees
    payment_intent = pull_funds_from_company(total_amount_with_fees)

    # Step 3: Create payout to transfer money from Stripe to Wise
    payout = create_stripe_payout(total_amount_with_fees, payment_intent)

    # Step 4: Update dividend round with payment information
    update_dividend_round_payment_status(payment_intent, payout)

    # Step 5: Mark consolidated invoice as paid
    mark_consolidated_invoice_as_paid(consolidated_invoice, payment_intent)

    {
      payment_intent_id: payment_intent.id,
      payout_id: payout.id,
      total_amount_with_fees: total_amount_with_fees,
      consolidated_invoice_id: consolidated_invoice.id,
    }
  end

  private
    attr_reader :dividend_round, :company

    def validate_prerequisites!
      raise Error, "Company does not have a bank account set up" unless company.bank_account_ready?
      raise Error, "Dividend round is not ready for payment" unless dividend_round.status == "Issued"
      raise Error, "Dividend round has no dividends to pay" if dividend_round.dividends.empty?
    end

    def calculate_total_amount_with_fees
      dividend_amount = dividend_round.total_amount_in_cents
      # Add processing fees (typically 2.9% + 30¢ for ACH)
      processing_fee = (dividend_amount * 0.029).round + 30
      transfer_fee = 500 # 5.00 fee for Wise transfer

      dividend_amount + processing_fee + transfer_fee
    end

    def pull_funds_from_company(amount_cents)
      # For development/testing, simulate payment without actually calling Stripe
      if Rails.env.development? && ENV["SKIP_STRIPE_PAYMENTS"] == "true"
        Rails.logger.info "SIMULATED: Payment pull of $#{amount_cents / 100.0} for dividend round #{dividend_round.external_id}"
        return OpenStruct.new(id: "sim_pi_#{SecureRandom.hex(12)}", latest_charge: OpenStruct.new(id: "sim_ch_#{SecureRandom.hex(12)}"))
      end

      stripe_setup_intent = company.bank_account.stripe_setup_intent

      Stripe::PaymentIntent.create({
        payment_method_types: ["us_bank_account"],
        payment_method: stripe_setup_intent.payment_method,
        customer: stripe_setup_intent.customer,
        confirm: true,
        amount: amount_cents,
        currency: "USD",
        expand: ["latest_charge"],
        capture_method: "automatic",
        description: "Dividend payment for round #{dividend_round.external_id}",
        metadata: {
          dividend_round_id: dividend_round.id,
          company_id: company.id,
          purpose: "dividend_funding",
        },
      })
    rescue Stripe::StripeError => e
      Rails.logger.error "Failed to pull funds for dividend round #{dividend_round.id}: #{e.message}"
      raise Error, "Failed to collect payment from company: #{e.message}"
    end

    def create_stripe_payout(amount_cents, payment_intent)
      # For development/testing, simulate payout without actually calling Stripe
      if Rails.env.development? && ENV["SKIP_STRIPE_PAYMENTS"] == "true"
        Rails.logger.info "SIMULATED: Payout of $#{dividend_round.total_amount_in_cents / 100.0} for dividend round #{dividend_round.external_id}"
        return OpenStruct.new(id: "sim_po_#{SecureRandom.hex(12)}")
      end

      # Only create payout for the actual dividend amount (excluding fees)
      dividend_amount = dividend_round.total_amount_in_cents

      Stripe::Payout.create({
        amount: dividend_amount,
        currency: "usd",
        description: "Dividend payout for round #{dividend_round.external_id}",
        statement_descriptor: "Flexile Dividend",
        metadata: {
          dividend_round_id: dividend_round.id,
          company_id: company.id,
          source_payment_intent: payment_intent.id,
        },
      })
    rescue Stripe::StripeError => e
      Rails.logger.error "Failed to create payout for dividend round #{dividend_round.id}: #{e.message}"
      raise Error, "Failed to create payout: #{e.message}"
    end

    def update_dividend_round_payment_status(payment_intent, payout)
      dividend_round.update!(
        status: "Paid",
        ready_for_payment: true,
      )

      # Store payment references in metadata or separate table if needed
      Rails.logger.info "Dividend round #{dividend_round.id} payment processing started. PaymentIntent: #{payment_intent.id}, Payout: #{payout.id}"
    end

    def create_dividend_consolidated_invoice
      # Calculate fees (processing fee + transfer fee)
      dividend_amount = dividend_round.total_amount_in_cents
      processing_fee = (dividend_amount * 0.029).round + 30
      transfer_fee = 500

      company.consolidated_invoices.create!(
        invoice_date: Date.current,
        invoice_number: "FX-DVD-#{company.consolidated_invoices.count + 1}",
        status: ConsolidatedInvoice::SENT,
        period_start_date: dividend_round.issued_at,
        period_end_date: dividend_round.issued_at,
        invoice_amount_cents: dividend_amount,
        flexile_fee_cents: processing_fee,
        transfer_fee_cents: transfer_fee,
        total_cents: dividend_amount + processing_fee + transfer_fee
      )
    end

    def mark_consolidated_invoice_as_paid(consolidated_invoice, payment_intent)
      # Create a successful consolidated payment record
      consolidated_invoice.consolidated_payments.create!(
        amount_cents: consolidated_invoice.total_cents,
        status: "succeeded",
        succeeded_at: Time.current,
        stripe_payment_intent_id: payment_intent.id
      )

      # Mark the consolidated invoice as paid
      consolidated_invoice.mark_as_paid!(timestamp: Time.current)

      Rails.logger.info "Created consolidated invoice #{consolidated_invoice.id} for dividend round #{dividend_round.id}"
    end
end
