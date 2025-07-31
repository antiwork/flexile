# frozen_string_literal: true

class Internal::Companies::DocumentsController < Internal::Companies::BaseController
  before_action :set_document, only: [:show, :destroy, :sign, :share]

  def index
    authorize Document

    documents = Current.company.documents
      .includes(signatures: :user, attachments_attachments: :blob)
      .where(deleted_at: nil)
      .joins(:signatures)
      .where(document_signatures: { user_id: Current.user.id })
      .distinct

    render json: documents.map { |doc| DocumentPresenter.new(doc).props }
  end

  def show
    render json: DocumentPresenter.new(@document).props
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
      render json: { errors: result[:error_message] }, status: :unprocessable_entity
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
      render json: { errors: signature.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def share
    authorize Document

    signer = Current.company.company_workers.find_by(external_id: params[:recipient])&.user

    unless signer
      render json: { errors: ["Recipient not found"] }, status: :unprocessable_entity and return
    end

    signed_at = Time.current if @document.link.present?
    signature = @document.signatures.find_or_initialize_by(user: signer)
    signature.update!(title: "Signer", signed_at:)

    if signature.persisted?
      render json: { message: "Document shared successfully" }, status: :ok
    else
      render json: { errors: signature.errors.full_messages }, status: :unprocessable_entity
    end
  end


  def destroy
    authorize Document

    if @document.signatures.where(signed_at: nil).none?
      render json: { errors: ["Cannot delete a signed document"] }, status: :unprocessable_entity and return
    end

    @document.update(deleted_at: Time.current)
    head :no_content
  end

  private
    def set_document
      @document = Current.company.documents.find(params[:id])
    end
end
