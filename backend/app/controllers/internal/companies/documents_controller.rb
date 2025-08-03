# frozen_string_literal: true

class Internal::Companies::DocumentsController < Internal::Companies::BaseController
  before_action :set_document, only: [:show, :destroy, :sign, :share]

  def index
    authorize Document

    filters = params.permit(:signable)

    documents = Current.company.documents
      .includes(signatures: :user, attachments_attachments: :blob)
      .where(deleted_at: nil)

    unless Current.user.administrator? || Current.user.lawyer?
      documents = documents.for_signatory(Current.user.id)
    end

    if filters[:signable] == "true"
      documents = documents.unsigned_by(Current.user.id)
    end

    documents = documents.distinct
    render json: documents.map { |doc| DocumentPresenter.new(doc).props }
  end

  def create
    authorize Document

    result = CreateDocument.new(
      params:,
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
    authorize Document

    unless @document.signatures.exists?(user: Current.user)
      render json: { errors: ["You are not allowed to sign this document"] }, status: :unprocessable_entity and return
    end

    signature = @document.signatures.where(user: Current.user, title: params[:title]).first
    signature.update!(signed_at: Time.current)

    if signature.save
      render json: DocumentPresenter.new(@document).props
    else
      render json: { error_message: signature.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def share
    authorize Document

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
        user: Current.user,
        title: "Company Representative",
        signed_at: Time.current
      )
      new_document.signatures.create!(
        user: signer,
        title: "Signer",
        signed_at: nil
      )

      if @document.attachments.attached?
        @document.attachments.each do |attachment|
          new_document.attachments.attach(
            io: StringIO.new(attachment.download),
            filename: attachment.filename.to_s,
            content_type: attachment.content_type
          )
        end
      end

      render json: { message: "Document shared successfully" }, status: :ok
    rescue ActiveRecord::RecordInvalid => e
      render json: { error_message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize Document

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
end
