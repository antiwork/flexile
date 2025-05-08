# frozen_string_literal: true

class GenerateTaxInformationDocumentJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(user_compliance_info_id, tax_year: Date.current.year)
    user_compliance_info = UserComplianceInfo.find(user_compliance_info_id)
    form_name = user_compliance_info.tax_information_document_name
    (user_compliance_info.user.clients + user_compliance_info.user.portfolio_companies).uniq.each do |company|
      GenerateTaxFormService.new(user_compliance_info:, form_name:, tax_year:, company:).process
    end
  end
end
