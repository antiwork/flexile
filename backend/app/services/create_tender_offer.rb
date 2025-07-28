# frozen_string_literal: true

class CreateTenderOffer
  def initialize(company:, attributes:, investor_ids: nil)
    @company = company
    @attributes = attributes
    @investor_ids = investor_ids
  end

  def perform
    tender_offer = @company.tender_offers.build(attributes)

    if @investor_ids.present?
      company_investors = @company.company_investors.where(external_id: @investor_ids)
      company_investors.each do |company_investor|
        tender_offer.tender_offer_investors.build(company_investor: company_investor)
      end
    elsif tender_offer.tender_offer_investors.empty? && tender_offer.buyback_type != "single_stock"
      @company.company_investors.each do |company_investor|
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
        ).deliver_later
      end
    end
end
