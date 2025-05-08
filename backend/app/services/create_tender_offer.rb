# frozen_string_literal: true

class CreateTenderOffer
  def initialize(company:, attributes:)
    @company = company
    @attributes = attributes
  end

  def perform
    tender_offer = @company.tender_offers.create!(attributes)

    { success: true, tender_offer: }
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    attr_reader :company, :attributes
end
