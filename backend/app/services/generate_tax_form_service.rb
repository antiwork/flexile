# frozen_string_literal: true

class GenerateTaxFormService
  def initialize(user_compliance_info:, document_type:, tax_year:, company:)
    raise ArgumentError, "Invalid form" unless Document::TAX_FORM_TYPES.include?(document_type.to_s)

    @user_compliance_info = user_compliance_info
    @tax_year = tax_year
    @document_type = document_type
    @company = company
  end

  def process
    return unless user_compliance_info.tax_information_confirmed_at?

    document = user_compliance_info.documents.alive.find_or_initialize_by(
      document_type:, year: tax_year, company:
    )

    return if document.persisted?

    pdf_output = StringIO.new
    pdf = HexaPDF::Document.open(Rails.root.join("config", "data", "tax_forms", "#{document.name}.pdf").to_s)
    acro_form = pdf.acro_form

    document.fetch_serializer.attributes.each do |field_name, value|
      field = acro_form.field_by_name(field_name)
      field.field_value = value if field
    end

    acro_form.flatten
    pdf.write(pdf_output)
    pdf_output.rewind

    document.attachments.attach(
      io: pdf_output,
      filename: "#{tax_year}-#{document.name}-#{company.name.parameterize}-#{user.billing_entity_name.parameterize}.pdf",
      content_type: "application/pdf",
    )

    # Automatically mark as signed tax information forms (W-8/W-9) because the user gave us their e-sign consent
    signed_at = document_type.in?(Document::SUPPORTED_TAX_INFORMATION_TYPES) ? Time.current : nil
    document.signatures.build(user:, title: "Signer", signed_at:)
    document.save!
    document
  end

  private
    attr_reader :user_compliance_info, :document_type, :tax_year, :company

    delegate :user, to: :user_compliance_info
end
