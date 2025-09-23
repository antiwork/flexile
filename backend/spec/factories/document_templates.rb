# frozen_string_literal: true

FactoryBot.define do
  factory :document_template do
    company
    trait :exercise_notice do
      document_type { DocumentTemplate.document_types[:exercise_notice] }
      text { "I am exercising" }
    end
  end
end
