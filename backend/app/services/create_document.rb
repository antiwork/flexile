# frozen_string_literal: true

class CreateDocument
  include ActionView::Helpers::SanitizeHelper


  def initialize(user:, company:, params:)
    @user = user
    @company = company
    @params = params
  end

  def perform!
    return { success: false, error_message: "Invalid parameters" } unless is_param_keys_valid?

    if params[:attachment].present? && !params[:attachment].respond_to?(:open)
      return { success: false, error_message: "Invalid attachment parameter" }
    end

    permitted = document_params.slice(:name, :document_type, :text_content)
    attributes = {
      **permitted,
      year: Date.current.year,
      company: company,
    }
    document = user.documents.build(attributes)
    document.attachments = document_params[:attachment] if document_params[:attachment].present?

    ActiveRecord::Base.transaction do
      signed_at = ActiveModel::Type::Boolean.new.cast(params[:signed]) ? Time.current : nil
      document.signatures.build(user: user, title: "Company Representative", signed_at: signed_at)
      if params[:recipient].present?
        signer = company.company_workers.find_by(external_id: params[:recipient])&.user
        document.signatures.build(user: signer, title: "Signer", signed_at: signed_at) if signer
      end
      document.save!
      if document.text_content.present?
        CreateDocumentAttachmentJob.perform_async(document.id)
      end
    end

    { success: true, document: document }
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error_message: e.record.errors.full_messages.to_sentence }
  end

  private
    attr_reader :company, :params, :user

    def document_params
      params[:document_type] = params[:document_type].to_i if params.key?(:document_type)
      params.to_h.slice(:name, :document_type, :text_content, :attachment, :signed, :recipient).compact
    end

    def is_param_keys_valid?
      keys = [params[:text_content], params[:attachment]]
      present_count = keys.count { |v| v.present? }
      present_count == 1
    end
end
