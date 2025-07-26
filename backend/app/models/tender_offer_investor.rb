# frozen_string_literal: true

class TenderOfferInvestor < ApplicationRecord
  include ExternalId

  belongs_to :tender_offer
  belongs_to :company_investor

  validates :tender_offer_id, uniqueness: { scope: :company_investor_id }
end
