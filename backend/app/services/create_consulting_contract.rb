# frozen_string_literal: true

# Creates a consulting contract document when the first party signs it
# First signature can be by either a company worker or a company administrator
#
class CreateConsultingContract
  def initialize(company_worker:, company_administrator:, contract:)
    @company_worker = company_worker
    @company_administrator = company_administrator
    @contract = contract
  end

  def perform!
    attributes = {
      name: Document::CONSULTING_CONTRACT_NAME,
      document_type: :consulting_contract,
      year: Date.current.year,
      company: company_worker.company,
    }.compact
    company_worker.user.documents.unsigned_contracts.each(&:mark_deleted!)
    document = company_worker.user.documents.build(attributes)
    if contract.is_a?(String)
      document.text = contract
    else
      document.attachments.attach(contract)
    end
    document.signatures.build(user: company_worker.user, title: "Signer", signed_at: contract.is_a?(String) ? nil : Time.current)
    document.save!
    document
  end

  private
    attr_reader :company_worker, :company_administrator, :contract
end
