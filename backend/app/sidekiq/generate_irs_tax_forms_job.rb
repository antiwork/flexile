# frozen_string_literal: true

class GenerateIrsTaxFormsJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(user_compliance_info_id, tax_year = Date.current.year - 1)
    user_compliance_info = UserComplianceInfo.find(user_compliance_info_id)
    user = user_compliance_info.user

    generate_tax_forms(
      company_user_klass: CompanyWorker,
      user_compliance_info:,
      user:,
      form_name: Document::FORM_1099_NEC,
      tax_year:,
    )

    generate_tax_forms(
      company_user_klass: CompanyInvestor,
      user_compliance_info:,
      user:,
      form_name: user_compliance_info.investor_tax_document_name,
      tax_year:,
    )
  end

  private
    def generate_tax_forms(company_user_klass:, user_compliance_info:, user:, form_name:, tax_year:)
      company_user_klass.with_required_tax_info_for(tax_year:)
                        .where(user:)
                        .includes(:company)
                        .find_each do |company_user|
        company = company_user.company
        next if user.documents.tax_document.alive.where(year: tax_year, name: form_name, company:).exists?

        GenerateTaxFormService.new(user_compliance_info:, form_name:, tax_year:, company:).process
      end
    end
end
