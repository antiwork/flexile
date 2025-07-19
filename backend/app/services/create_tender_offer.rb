# frozen_string_literal: true

class CreateTenderOffer
  def initialize(company:, attributes:)
    @company = company
    @attributes = attributes
  end

  def perform
    investors = attributes.delete(:investors) || []

    tender_offer = @company.tender_offers.build(attributes)

    if investors.present?
      company_investors = @company.company_investors.where(external_id: investors)
      company_investors.each do |company_investor|
        tender_offer.tender_offer_investors.build(company_investor: company_investor)
      end
    end

    tender_offer.save!

    send_investor_notifications(tender_offer)

    { success: true, tender_offer: }
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    attr_reader :company, :attributes

    def send_investor_notifications(tender_offer)
      tender_offer.tender_offer_investors.includes(:company_investor).each do |tender_offer_investor|
        CompanyInvestorMailer.tender_offer_opened(
          tender_offer_investor.company_investor.id,
          tender_offer_id: tender_offer.id
        ).deliver_now
      end
    end
end
