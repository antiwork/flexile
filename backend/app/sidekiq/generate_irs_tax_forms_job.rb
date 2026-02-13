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
      document_type: :form_1099nec,
      tax_year:,
    )

    generate_tax_forms(
      company_user_klass: CompanyInvestor,
      user_compliance_info:,
      user:,
      document_type: user_compliance_info.investor_tax_document_type,
      tax_year:,
    )

    if user_compliance_info.requires_w9?
      generate_return_of_capital_tax_forms(user_compliance_info:, user:, tax_year:)
    end
  end

  private
    def generate_tax_forms(company_user_klass:, user_compliance_info:, user:, document_type:, tax_year:)
      company_user_klass.with_required_tax_info_for(tax_year:)
                        .where(user:)
                        .includes(:company)
                        .find_each do |company_user|
        company = company_user.company
        next if user.documents.tax_document.alive.where(year: tax_year, document_type:, company:).exists?

        GenerateTaxFormService.new(user_compliance_info:, document_type:, tax_year:, company:).process
      end
    end

    def generate_return_of_capital_tax_forms(user_compliance_info:, user:, tax_year:)
      CompanyInvestor.with_return_of_capital_dividends_for(tax_year:)
                     .where(user:)
                     .includes(:company)
                     .find_each do |company_investor|
        company = company_investor.company
        next if user.documents.tax_document.alive.where(year: tax_year, document_type: :form_1099b, company:).exists?

        GenerateTaxFormService.new(user_compliance_info:, document_type: :form_1099b, tax_year:, company:).process
      end
    end
end
