# frozen_string_literal: true

class CreateDocument
  include ActionView::Helpers::SanitizeHelper


  def initialize(params:, user:, company:)
    @params = params
    @user = user
    @company = company
  end

  def perform!
    return { success: false, error_message: "Invalid parameters" } unless is_param_keys_valid?

    attributes = {
      **document_params,
      document_type: 0,
      year: Date.current.year,
      company: @company,
    }
    @document = @user.documents.build(attributes)

    @document.signatures.build(user: @user, title: "Company Representative", signed_at: Time.current)

    if @params[:recipient].present?
      signed_at = Time.current if @params[:signed] == true || @params[:link].present?
      signer = @company.company_workers.find_by(external_id: @params[:recipient])&.user
      @document.signatures.build(user: signer, title: "Signer", signed_at: signed_at) if signer
    end

    @document.save!

    if @document.text_content.present?
      html = @document.text_content
      pdf = CreatePdf.new(body_html: sanitize(html)).perform
      @document.attachments.attach(
        io: StringIO.new(pdf),
        filename: "#{@document.name.parameterize}.pdf",
        content_type: "application/pdf",
      )
    end

    { success: true, document: @document }
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    attr_reader :company, :params, :user

    def document_params
      params.permit(:name, :text_content, :attachment, :link)
    end

    def is_param_keys_valid?
      keys = [params[:link], params[:text_content], params[:attachment]]
      present_count = keys.count { |v| v.present? }
      present_count == 1
    end
end
