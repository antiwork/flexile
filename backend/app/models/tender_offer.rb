# frozen_string_literal: true

class TenderOffer < ApplicationRecord
  include ExternalId

  VESTED_SHARES_CLASS = "Vested shares from equity grants"

  belongs_to :company
  has_many :bids, class_name: "TenderOfferBid"
  has_many :equity_buyback_rounds
  has_one_attached :attachment

  validates :attachment, presence: true
  validates :starts_at, presence: true
  validates :ends_at, presence: true
  validates :minimum_valuation, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :number_of_shares, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :number_of_shareholders, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :total_amount_in_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :accepted_price_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validate :ends_at_must_be_after_starts_at
  validate :correct_attachment_mime_type

  def open?
    Time.current.between?(starts_at, ends_at)
  end

  def securities_available_for_purchase(company_investor)
    securities = []

    ShareHolding.joins(:share_class).where(company_investor:).group("share_classes.name")
      .select("share_classes.name AS share_class_name, SUM(share_holdings.number_of_shares) AS total_shares")
      .each do |result|
      securities << { class_name: result.share_class_name, count: result.total_shares }
    end
    vested_shares = company_investor.equity_grants.where("vested_shares > 0").sum(:vested_shares)
    securities << { class_name: VESTED_SHARES_CLASS, count: vested_shares } if vested_shares.positive?

    securities
  end

  private
    def ends_at_must_be_after_starts_at
      return if ends_at.blank? || starts_at.blank?

      if ends_at < starts_at
        errors.add(:ends_at, "must be after starts at")
      end
    end

    def correct_attachment_mime_type
      if attachment.attached? && !attachment.content_type.in?(%w(application/zip))
        errors.add(:attachment, "must be a ZIP file")
      end
    end
end
