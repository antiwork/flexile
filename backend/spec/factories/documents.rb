# frozen_string_literal: true

FactoryBot.define do
  factory :document do
    company
    user_compliance_info
    year { Date.current.year }
    attachments { [Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.pdf"))] }

    document_type { Document.document_types[:consulting_contract] }

    transient do
      signed { true }
      signatories { [] }
    end

    after :build do |document, evaluator|
      if evaluator.signatories.any?
        evaluator.signatories.each do |signatory|
          title = signatory.company_worker_for(document.company) ? "Signer" : "Company Representative"
          document.signatures.build(user: signatory, title:, signed_at: evaluator.signed ? Time.current : nil)
        end
      else
        if document.tax_document?
          user = document.user_compliance_info.user
        else
          company_worker = create(:company_worker, without_contract: true)
          user = company_worker.user
          document.company = company_worker.company
        end
        document.signatures.build(user:, title: "Signer", signed_at: evaluator.signed ? Time.current : nil)

        if document.consulting_contract? || document.equity_plan_contract?
          document.signatures.build(user: create(:company_administrator, company: company_worker.company).user, title: "Company Representative", signed_at: evaluator.signed ? Time.current : nil)
        end
      end
    end

    factory :equity_plan_contract_doc do
      document_type { Document.document_types[:equity_plan_contract] }
      equity_grant { create(:equity_grant, company_investor: create(:company_investor, company:)) }
    end

    factory :tax_doc do
      document_type { Document::TAX_FORM_TYPES.sample }
      user_compliance_info { create(:user_compliance_info) }

      trait :deleted do
        deleted_at { Time.current }
      end
    end

    factory :share_certificate_doc do
      document_type { Document.document_types[:share_certificate] }
      name { "Share Certificate" }
    end

    factory :exercise_notice do
      document_type { Document.document_types[:exercise_notice] }
      name { "XA-23 Form of Notice of Exercise (US) 2024.pdf" }
      signed
    end
  end
end
