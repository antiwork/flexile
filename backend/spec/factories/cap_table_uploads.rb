# frozen_string_literal: true

FactoryBot.define do
  factory :cap_table_upload do
    company
    user
    uploaded_at { Time.current }
    status { "submitted" }

    trait :with_json_file do
      after(:build) do |upload|
        upload.files.attach(
          io: StringIO.new("cap table data"),
          filename: "cap_table.json",
          content_type: "application/json"
        )
      end
    end

    trait :with_excel_file do
      after(:build) do |upload|
        upload.files.attach(
          io: StringIO.new("excel data"),
          filename: "cap_table.xlsx",
          content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      end
    end
  end
end
