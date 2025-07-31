# frozen_string_literal: true

class DocumentPresenter
  delegate :id, :name, :created_at, :document_type, :document_type_before_type_cast, :attachments, :signatures, :signed, :year, :source_type, :link, :text_content, :deleted_at, to: :document, private: true

  def initialize(document)
    @document = document
  end

  def props
    {
      id: id,
      name: name,
      created_at: created_at&.iso8601,
      type: document_type_before_type_cast,
      signed: signatories.all? { |s| s[:signed_at].present? },
      year: year,
      link: link,
      text_content: text_content,
      deleted_at: deleted_at&.iso8601,
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
          id: signature.id,
          user_id: signature.user.external_id,
          name: signature.user.name,
          email: signature.user.email,
          title: signature.title,
          signed_at: signature.signed_at&.iso8601,
        }
      end
    end
end
