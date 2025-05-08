# frozen_string_literal: true

class ShareHolding < ApplicationRecord
  has_paper_trail

  belongs_to :company_investor
  belongs_to :company_investor_entity, optional: true
  belongs_to :equity_grant, optional: true
  belongs_to :share_class

  validates :name, presence: true
  validates :issued_at, presence: true
  validates :originally_acquired_at, presence: true
  validates :number_of_shares, presence: true
  validates :share_price_usd, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :total_amount_in_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :share_holder_name, presence: true
  validate :name_must_be_unique_per_company

  after_create_commit :increment_total_shares
  after_update_commit :update_total_shares, if: :saved_change_to_number_of_shares?
  after_destroy_commit :decrement_total_shares
  after_create_commit :create_share_certificate

  def create_share_certificate
    return unless Flipper.enabled?(:share_certificates, company_investor.company)

    CreateShareCertificatePdfJob.perform_async(id)
  end

  private
    def name_must_be_unique_per_company
      return unless company_investor
      return unless company_investor.company.share_holdings.where.not(id:).where(name:).exists?

      errors.add(:name, "must be unique across the company")
    end

    def increment_total_shares
      company_investor.increment!(:total_shares, number_of_shares)
      company_investor_entity&.increment!(:total_shares, number_of_shares)
    end

    def update_total_shares
      share_diff = saved_change_to_number_of_shares[1] - saved_change_to_number_of_shares[0]
      company_investor.increment!(:total_shares, share_diff)
      company_investor_entity&.increment!(:total_shares, share_diff)
    end

    def decrement_total_shares
      company_investor.increment!(:total_shares, -number_of_shares)
      company_investor_entity&.increment!(:total_shares, -number_of_shares)
    end
end
