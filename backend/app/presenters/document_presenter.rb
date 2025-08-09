# frozen_string_literal: true

class DocumentPresenter
  delegate :id, :name, :created_at, :document_type, :document_type_before_type_cast, :attachments, :signatures, :signed, :year, :source_type, :text_content, :deleted_at, to: :document, private: true

  def initialize(document)
    @document = document
  end

  def props
    {
      id: id.to_s,
      name: name,
      createdAt: created_at&.iso8601,
      type: document_type_before_type_cast,
      year: year,
      textContent: text_content,
      deletedAt: deleted_at&.iso8601,
      attachment: attachments&.first ? {
        key: attachments.first.key,
        filename: attachments.first.filename,
      } : nil,
      signatories: signatories,
    }
  end

  private
    attr_reader :document

    def signatories
      document.signatures.map do |signature|
        {
          id: signature.user.external_id.to_s,
          name: signature.user.name || signature.user.email,
          email: signature.user.email,
          title: signature.title,
          signedAt: signature.signed_at&.iso8601,
        }
      end
    end
end
