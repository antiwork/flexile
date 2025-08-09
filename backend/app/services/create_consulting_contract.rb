# frozen_string_literal: true

# Creates a consulting contract document when the first party signs it
# First signature can be by either a company worker or a company administrator
#
class CreateConsultingContract
  def initialize(company_worker:, company_administrator:, current_user:, document_params:)
    @company_worker = company_worker
    @company_administrator = company_administrator
    @current_user = current_user
    @document_params = document_params
  end

  def perform!
    attributes = {
      name: document_params[:name],
      attachment: document_params[:attachment],
      text_content: document_params[:text_content],
      document_type: Document.document_types[:consulting_contract],
      recipient: company_worker.external_id,
    }

    company_worker.user.documents.unsigned_contracts.find_each(&:mark_deleted!)

    result = CreateDocument.new(
      user: company_administrator.user,
      company: company_worker.company,
      params: attributes
    ).perform!

    result[:document]
  end

  private
    attr_reader :company_worker, :company_administrator, :current_user, :document_params
end
