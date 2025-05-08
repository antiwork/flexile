# frozen_string_literal: true

FactoryBot.define do
  factory :quickbooks_integration, parent: :integration, class: "QuickbooksIntegration" do
    type { "QuickbooksIntegration" }
    account_id { "4620816365264855310" }
    configuration do
      {
        access_token: "eyJlbmSAMPLELUhTMjU2IiwiYWxnIjoiZGlyIn0..lwGAESS-8jyltYyF74KB6g.n3AE424o2dQbhoZ53n_t3kaSZz3yQIDrVJqNUmdJF4Ade4d_TRS55uNEoUCQkFQtuTKBA6OaXnW3PZk4qN94n2Zje4opWn1qiMOd8-cs1ZfXywje8rttIxsQPqdBHTkWMKWnt3ZmThWKLiRkXUY6bycE8o1n_QNwLb1dIOnaB7nAPy-hGD1maonRdt_-Ssw4BbdR1fyllz-5r2fYJMtIF35ITlcMT_YIpvtbmeJ8MW37wsvA-GqhGrVL9uihRaknp2LapgQLnQV51K4BK5BLMwcfemgSAObDqWYqO4etjbTiVWY6VPbk6pil9Z0CBX2_Q911WjKu8OA9FvpDwX2ZTHIZe7voCFmD6V_rtcLqNXno05As7H0zT8sjFktxWhxvMDY8KcvNvnAvCBJf21aDElOrNVuRtKsKOU95HKEFHQnSSl4NDVlf7FT4HB3Wp3p2PGlfoeMgKXr6SR3SU25PAu30_64bmDIKCKP5XL3F7gRQwPHF9qiqgfGqSwI6tyoSnIvN6LWccK_g4ouZV4LWd_Xp_0slQqa5bp6OltV18wbTH2-mdSbIrC9-FHISChQOoH65i2T6fy46r0dMPv_hv7T6GecTnNs6DtIx0f5CmpcaL1NG56JKBjz0LaWvvvLpyb2SzzfKd9O3SGnsg6ksVmaIksR4fjzzkwGlrW8GCWk7foghpfeMKbCL2SAMPLEkOrfKu4W9avYJwbKQlNhaaeiqeMvXoJGX14IzEkzWVMJv3-OQXkGny-TO0l6dG4ge.wkffVC8gVg775iIyTZ-hPQ",
        expires_at: 1.hour.from_now.utc.iso8601,
        refresh_token: "AB117276859SAMPLExA1wXHKJCkvwkwjkNfaIrX0v5U7y",
        refresh_token_expires_at: "2024-06-22T08:45:30.925Z",
        flexile_vendor_id: "83",
        consulting_services_expense_account_id: "59",
        equity_compensation_expense_account_id: "34",
        flexile_fees_expense_account_id: "10",
        flexile_clearance_bank_account_id: "94",
        default_bank_account_id: "93",
      }
    end

    trait :with_incomplete_setup do
      status { Integration.statuses[:initialized] }
      consulting_services_expense_account_id { nil }
      equity_compensation_expense_account_id { nil }
      flexile_fees_expense_account_id { nil }
      flexile_clearance_bank_account_id { nil }
      default_bank_account_id { nil }
      flexile_vendor_id { nil }
    end
  end
end
