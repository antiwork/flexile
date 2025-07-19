# frozen_string_literal: true

class TenderOffer < ApplicationRecord
  include ExternalId

  VESTED_SHARES_CLASS = "Vested shares from equity grants"

  enum :buyback_type, {
    single_stock: "single_stock",
    tender_offer: "tender_offer",
  }

  belongs_to :company
  has_many :bids, class_name: "TenderOfferBid"
  has_many :equity_buyback_rounds
  has_many :tender_offer_investors
  has_one_attached :attachment
  has_one_attached :letter_of_transmittal

  validates :buyback_type, presence: true
  validates :name, presence: true
  validates :attachment, presence: true
  validates :letter_of_transmittal, presence: true, on: :create
  validates :starts_at, presence: true
  validates :ends_at, presence: true
  validates :minimum_valuation, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :number_of_shares, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :number_of_shareholders, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :total_amount_in_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :accepted_price_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :starting_price_per_share_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  # validates :fully_diluted_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  validate :ends_at_must_be_after_starts_at
  validate :correct_attachment_mime_type
  validate :validate_investor_requirements

  def open?
    Time.current.utc.between?(starts_at, ends_at)
  end

  # def implied_valuation
  #   return nil if accepted_price_cents.nil? || fully_diluted_shares.nil?

  #   (accepted_price_cents / 100) * fully_diluted_shares.to_i
  # end

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

      if letter_of_transmittal.attached? && !letter_of_transmittal.content_type.in?(%w(application/pdf))
        errors.add(:letter_of_transmittal, "must be a PDF file")
      end
    end

    def validate_investor_requirements
      if tender_offer_investors.size == 0
        errors.add(:base, "At least one investor must be selected")
        return
      end

      if buyback_type == "single_stock" && tender_offer_investors.size != 1
        errors.add(:buyback_type, "Single stock repurchases can only have one investor")
      end
    end
end
