# frozen_string_literal: true

class Internal::Companies::DocumentsController < Internal::Companies::BaseController
  before_action :set_document, only: [:sign]

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

  private
    def set_document
      @document = Current.company.documents.find(params[:id])
    end

    def document_params
      params.permit(:name, :document_type, :text_content, :year, :attachment, :signed, :recipient)
    end
end
