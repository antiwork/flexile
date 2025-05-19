# frozen_string_literal: true

class CompanyStripeAccount < ApplicationRecord
  include Deletable

  INITIAL = "initial"
  PROCESSING = "processing"
  ACTION_REQUIRED = "action_required"
  READY = "ready"
  FAILED = "failed"
  CANCELLED = "cancelled"
  STATUSES = [INITIAL, PROCESSING, ACTION_REQUIRED, READY, CANCELLED, FAILED]

  belongs_to :company

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :setup_intent_id, presence: true

  after_create_commit :delete_older_records!, unless: :deleted?

  def ready? = status == READY

  def initial_setup_completed? = status.present? && status != INITIAL

  def stripe_setup_intent
    @_stripe_setup_intent ||= Stripe::SetupIntent.retrieve({ id: setup_intent_id, expand: ["payment_method"] })
  end

  def fetch_stripe_bank_account_last_four
    stripe_setup_intent.payment_method&.us_bank_account&.last4
  end

  def microdeposit_verification_required?
    return false if ready?
    stripe_setup_intent.status == "requires_action" && stripe_setup_intent.next_action&.type == "verify_with_microdeposits"
  end

  def microdeposit_verification_details
    return unless microdeposit_verification_required?
    details = stripe_setup_intent.next_action.verify_with_microdeposits

    {
      arrival_timestamp: details.arrival_date,
      microdeposit_type: details.microdeposit_type,
      bank_account_number: bank_account_last_four ? "****#{bank_account_last_four}" : nil,
    }
  end

  private
    def delete_older_records!
      company.company_stripe_accounts.alive.where.not(id:).each(&:mark_deleted!)
    end
end
