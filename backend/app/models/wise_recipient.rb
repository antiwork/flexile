# frozen_string_literal: true

class WiseRecipient < ApplicationRecord
  include Deletable

  belongs_to :user
  belongs_to :wise_credential

  before_validation :assign_default_used_for_invoices_and_dividends, on: :create

  validates :user_id, presence: true
  validates :country_code, presence: true
  validates :currency, presence: true
  validates :recipient_id, presence: true
  validates :wise_credential, presence: true
  validates :used_for_invoices, uniqueness: { conditions: -> { alive.where(used_for_invoices: true) }, scope: :user_id }, if: [:used_for_invoices?, :used_for_invoices_changed?]
  validates :used_for_dividends, uniqueness: { conditions: -> { alive.where(used_for_dividends: true) }, scope: :user_id }, if: [:used_for_dividends?, :used_for_dividends_changed?]

  after_destroy :reassign_used_for_invoices_and_dividends

  def details
    details = recipient["details"]
    details["accountHolderName"] = recipient["accountHolderName"]
    flatten_hash(details)
  end

  def edit_props
    {
      id:,
      currency:,
      details:,
      last_four_digits:,
      used_for_invoices:,
      used_for_dividends:,
    }
  end

  def mark_deleted!
    ApplicationRecord.transaction do
      super
      reassign_used_for_invoices_and_dividends
    end
  end

  def reassign_used_for_invoices_and_dividends
    return unless used_for_invoices? || used_for_dividends?
    new_default_bank_account = user&.bank_accounts&.alive&.last
    return unless new_default_bank_account

    new_default_bank_account.used_for_invoices = true if used_for_invoices?
    new_default_bank_account.used_for_dividends = true if used_for_dividends?
    new_default_bank_account.save!
  end

  private
    def recipient
      @recipient ||= Wise::PayoutApi.new(wise_credential:).get_recipient_account(recipient_id:)
    end

    def assign_default_used_for_invoices_and_dividends
      return if user&.bank_accounts&.alive&.exists?

      self.used_for_invoices = true
      self.used_for_dividends = true
    end

    def flatten_hash(hash)
      hash.each_with_object({}) do |(k, v), h|
        if v.is_a? Hash
          flatten_hash(v).map do |h_k, h_v|
            h["#{k}.#{h_k}".to_sym] = h_v
          end
        else
          h[k] = v
        end
      end
    end
end
