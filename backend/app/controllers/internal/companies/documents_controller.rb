# frozen_string_literal: true

class Internal::Companies::DocumentsController < Internal::Companies::BaseController
  before_action :set_document, only: [:destroy, :sign, :share]

  def index
    authorize Document

    company_representative = Current.user.administrator? || Current.user.lawyer?
    filters = params.permit(:signable, :type)

    documents = Current.company.documents
      .includes(signatures: :user, attachments_attachments: :blob)
      .where(deleted_at: nil)
      .order(created_at: :asc)
    documents = documents.for_signatory(Current.user.id) unless company_representative
    documents = documents.where(document_type: params[:type].to_i) if filters[:type].present?
    documents = documents.unsigned_by(company_representative ? "Company Representative" : "Signer") if filters[:signable] == "true"
    documents = documents.distinct
    render json: documents.map { |doc| DocumentPresenter.new(doc).props }
  end

  def create
    authorize Document

    result = CreateDocument.new(
      params: document_params,
      user: Current.user,
      company: Current.company,
    ).perform!

    if result[:success]
      render json: DocumentPresenter.new(result[:document]).props, status: :created
    else
      render json: { error_message: result[:error_message] }, status: :unprocessable_entity
    end
  end

  def sign
    authorize @document, :sign?

    unless params[:signature].present?
      render json: { error_message: "Signature is required" }, status: :unprocessable_entity and return
    end

    signature = @document.signatures.find_by(user: Current.user, signed_at: nil, title: params[:title])
    unless signature
      render json: { error_message: "You are not allowed to sign this document" }, status: :unprocessable_entity and return
    end

    if signature.update(signed_at: Time.current, signature: params[:signature])
      render json: DocumentPresenter.new(@document.reload).props
    else
      render json: { error_message: signature.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def share
    authorize @document, :share?

    signer = Current.company.company_workers.find_by(external_id: params[:recipient])&.user

    unless signer
      render json: { error_message: "Recipient not found" }, status: :unprocessable_entity and return
    end

    if @document.signatures.exists?(user: signer)
      render json: { error_message: "Document already shared with this recipient" }, status: :unprocessable_entity and return
    end

    ActiveRecord::Base.transaction do
      new_document = @document.dup
      new_document.year = Time.current.year
      new_document.save!

      new_document.signatures.create!(
        [
          { user: Current.user, title: "Company Representative" },
          { user: signer, title: "Signer" }
        ]
      )

      if @document.attachments.attached?
        attachments = @document.attachments.map do |attachment|
          {
            io: StringIO.new(attachment.download),
            filename: attachment.filename.to_s,
            content_type: attachment.content_type,
          }
        end
        new_document.attachments.attach(attachments)
      end

      render json: { message: "Document shared successfully", document: DocumentPresenter.new(new_document).props }, status: :ok
    end
  rescue ActiveRecord::RecordInvalid => e
    render json: { error_message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def destroy
    authorize @document, :destroy?

    if @document.signatures.where(signed_at: nil).none?
      render json: { error_message: "Cannot delete a signed document" }, status: :unprocessable_entity and return
    end

    @document.mark_deleted!
    head :no_content
  end

  private
    def set_document
      @document = Current.company.documents.find(params[:id])
    end

    def document_params
      params.permit(:name, :document_type, :text_content, :year, :attachment, :signed, :recipient)
    end
end
