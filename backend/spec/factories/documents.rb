# frozen_string_literal: true

FactoryBot.define do
  factory :document do
    company
    user_compliance_info
    year { Date.current.year }
    attachments { [Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.pdf"))] }

    # Consulting contract
    name { Contract::CONSULTING_CONTRACT_NAME }
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
      name { "Equity Incentive Plan #{Date.current.year}" }
      document_type { Document.document_types[:equity_plan_contract] }
      equity_grant { create(:equity_grant, company_investor: create(:company_investor, company:)) }
    end

    factory :tax_doc do
      document_type { Document.document_types[:tax_document] }
      name { Document::ALL_SUPPORTED_TAX_FORM_NAMES.sample }
      user_compliance_info { create(:user_compliance_info) }

      trait :deleted do
        deleted_at { Time.current }
      end

      trait :form_w9 do
        name { Document::FORM_W_9 }
      end

      trait :form_w8ben do
        name { Document::FORM_W_8BEN }
      end

      trait :form_w8bene do
        name { Document::FORM_W_8BEN_E }
      end

      trait :form_1099div do
        name { Document::FORM_1099_DIV }
      end

      trait :form_1099nec do
        name { Document::FORM_1099_NEC }
      end

      trait :form_1042s do
        name { Document::FORM_1042_S }
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
