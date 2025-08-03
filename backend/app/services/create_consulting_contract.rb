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
    params = document_params.dup
    params[:recipient] = company_worker.external_id
    company_worker.user.documents.unsigned_contracts.each(&:mark_deleted!)
    document = CreateDocument.new(
      user: company_administrator.user,
      company: company_worker.company,
      params: params
    ).perform![:document]

    document
  end

  private
    attr_reader :company_worker, :company_administrator, :current_user, :document_params
end
