# frozen_string_literal: true

FactoryBot.define do
  factory :contract do
    company_administrator
    company { company_administrator.company }
    company_worker
    user { company_worker.user }
    name { Contract::CONSULTING_CONTRACT_NAME }

    factory :equity_plan_contract do
      equity_options_plan { true }
      equity_grant
      name { "Equity Incentive Plan #{Date.current.year}" }
    end

    trait :certificate do
      company_worker { nil }
      user
      certificate { true }
      name { "#{('A'..'Z').to_a.sample}-#{rand(101)}" }
    end

    trait :signed do
      signed_at { Time.current }

      after :build do |contract|
        contract.contractor_signature ||= contract.company_worker.user.legal_name
      end
    end

    trait :unsigned do
      signed_at { nil }
    end

    after :build do |contract|
      contract.administrator_signature ||= contract.company_administrator.user.legal_name
      contract.attachment.attach(io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")), filename: "contract.pdf")
    end
  end
end
