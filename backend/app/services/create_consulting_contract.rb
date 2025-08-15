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
    attributes[contract.is_a?(String) ? :text : attachment] = contract
    company_worker.user.documents.unsigned_contracts.each(&:mark_deleted!)
    document = company_worker.user.documents.build(attributes)
    document.signatures.build(user: company_administrator.user, title: "Company Representative")
    document.signatures.build(user: company_worker.user, title: "Signer")
    document.save!
    document
  end

  private
    attr_reader :company_worker, :company_administrator, :contract
end
