# frozen_string_literal: true

FactoryBot.define do
  factory :tax_document do
    user_compliance_info
    company
    name { TaxDocument::FORM_W_9 }
    tax_year { Date.today.year }
    status { TaxDocument.statuses[:initialized] }

    after :build do |tax_document|
      tax_document.attachment.attach(io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")), filename: "tax_document.pdf")
    end

    trait :submitted do
      status { TaxDocument.statuses[:submitted] }
      submitted_at { Time.current }
    end

    trait :deleted do
      status { TaxDocument.statuses[:deleted] }
      deleted_at { Time.current }
    end

    trait :form_w9 do
      name { TaxDocument::FORM_W_9 }
    end

    trait :form_w8ben do
      name { TaxDocument::FORM_W_8BEN }
    end

    trait :form_w8bene do
      name { TaxDocument::FORM_W_8BEN_E }
    end

    trait :form_1099div do
      name { TaxDocument::FORM_1099_DIV }
    end

    trait :form_1099nec do
      name { TaxDocument::FORM_1099_NEC }
    end

    trait :form_1042s do
      name { TaxDocument::FORM_1042_S }
    end
  end
end
