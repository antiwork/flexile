# frozen_string_literal: true

class GenerateTaxInformationDocumentJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(user_compliance_info_id, tax_year: Date.current.year)
    user_compliance_info = UserComplianceInfo.find(user_compliance_info_id)
    document_type = user_compliance_info.tax_information_document_type
    (user_compliance_info.user.clients + user_compliance_info.user.portfolio_companies).uniq.each do |company|
      GenerateTaxFormService.new(user_compliance_info:, document_type:, tax_year:, company:).process
    end
  end
end
