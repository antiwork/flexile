# frozen_string_literal: true

RSpec.describe "Cap table page" do
  let(:company) do
    company = create(:company, fully_diluted_shares: 12_000_000)
    Flipper.enable(:cap_table, company)
    company
  end
  let(:share_class_common) { create(:share_class, company:, name: "Common") }
  let!(:option_pool) do
    create(:option_pool, share_class: share_class_common, company:,
                         authorized_shares: 11_000_000, issued_shares: 1_000_000)
  end

  shared_examples "a user with access" do
    context "when records exist" do
      let(:user1) { create(:user, email: "founder@example.com", legal_name: "Flexy Founder") }
      let(:user2) { create(:user, email: "partner@example.com", legal_name: "Partner Example") }
      let(:user3) { create(:user, email: "contractor+1@example.com", legal_name: "John Doe") }
      let(:user4) { create(:user, email: "contractor+2@example.com", legal_name: "Jane Snow") }
      let(:company_investor1) do
        # The upcoming_dividend_cents is set to null to test the UI rendering but it should not happen really
        create(:company_investor, user: user1, company:, cap_table_notes: "Founder")
      end
      let(:company_investor2) do
        create(:company_investor, user: user2, company:, cap_table_notes: "Partner",
                                  upcoming_dividend_cents: 349_913_90)
      end
      let(:company_investor3) do
        create(:company_investor, user: user3, company:,)
      end
      let(:company_investor4) do
        create(:company_investor, user: user4, company:,)
      end
      let(:company_investor_entity1) do
        create(:company_investor_entity,
               email: user1.email,
               name: user1.legal_name,
               company: company,
               cap_table_notes: "Founder")
      end

      let(:company_investor_entity2) do
        create(:company_investor_entity,
               email: user2.email,
               name: user2.legal_name,
               company: company,
               cap_table_notes: "Partner")
      end

      let(:company_investor_entity3) do
        create(:company_investor_entity,
               email: user3.email,
               name: user3.legal_name,
               company: company)
      end

      let(:company_investor_entity4) do
        create(:company_investor_entity,
               email: user4.email,
               name: user4.legal_name,
               company: company)
      end
      let(:share_class_A) { create(:share_class, company:, name: "Class A") }
      let(:share_class_B) { create(:share_class, company:, name: "Class B") }

      before do
        create(:share_holding, share_class: share_class_A, company_investor: company_investor1,
                               company_investor_entity: company_investor_entity1, number_of_shares: 500_123)
        create(:share_holding, share_class: share_class_B, company_investor: company_investor2,
                               company_investor_entity: company_investor_entity2, number_of_shares: 400_000)
        create(:share_holding, share_class: share_class_common, company_investor: company_investor2,
                               company_investor_entity: company_investor_entity2, number_of_shares: 99_877)
        create(:convertible_investment, company:, entity_name: "Republic.co",
                                        implied_shares: 1_000_000,
                                        convertible_type: "Crowd SAFE",
                                        upcoming_dividend_cents: 700_000_00)
        create(:equity_grant, company_investor: company_investor3, company_investor_entity: company_investor_entity3,
                              option_pool:, number_of_shares: 378_987, vested_shares: 192_234, unvested_shares: 186_753)
        create(:equity_grant, company_investor: company_investor4, company_investor_entity: company_investor_entity4,
                              option_pool:, number_of_shares: 621_013, vested_shares: 398_234, unvested_shares: 222_779)
        [company_investor_entity3, company_investor3].each { |entity| entity.update!(total_options: 378_987) }
        [company_investor_entity4, company_investor4].each { |entity| entity.update!(total_options: 621_013) }
      end

      def selection_assertions(can_view_investor)
        if can_view_investor
          expect(page).to have_unchecked_field "Select all"
          check "Select row", checked: false, match: :first
          expect(page).to have_text("1 selected")
          check "Select row", checked: false, match: :first
          expect(page).to have_text("2 selected")
          check "Select row", checked: false, match: :first
          expect(page).to have_text("3 selected")
          check "Select row", checked: false, match: :first
          expect(page).to have_text("4 selected")
          uncheck "Select all", checked: true
          expect(page).to have_unchecked_field "Select row", count: 4
          check "Select all"
          expect(page).to have_text("4 selected")
        else
          expect(page).not_to have_field "Select all"
        end
      end

      it "shows the cap table for the company" do
        Flipper.enable(:upcoming_dividend, company)

        sign_in user

        visit spa_company_cap_table_path(company.external_id)

        # Tab heading
        expect(page).to have_text("Cap table")

        within(first("table")) do
          expect(page).to have_selector("tbody > tr", count: 6)
          expect(page).to have_selector("tfoot > tr", count: 1)
        end
        expect(page).to have_table(with_rows: [
                                     {
                                       "Name" => "Flexy Founder#{can_view_investor ? " founder@example.com" : nil}",
                                       "Fully diluted shares" => "500,123",
                                       "Outstanding shares" => "500,123",
                                       "Outstanding ownership" => "50.012%", # (500,123 * 100 / (500,123 + 499,877)) with 3 decimals
                                       "Fully diluted ownership" => "4.168%", # (500,123 * 100 / 12,000,000) with 3 decimals
                                       "Upcoming dividend" => "—",
                                       "Notes" => "Founder",
                                     },
                                     {
                                       "Name" => "Partner Example#{can_view_investor ? " partner@example.com" : nil}",
                                       "Fully diluted shares" => "499,877",
                                       "Outstanding shares" => "499,877",
                                       "Outstanding ownership" => "49.988%", # (499,877 * 100 / (500,123 + 499,877)) with 3 decimals
                                       "Fully diluted ownership" => "4.166%", # (499,877 * 100 / 12_000,000) with 3 decimals
                                       "Upcoming dividend" => "$349,913.90",
                                       "Notes" => "Partner",
                                     },
                                     {
                                       "Name" => "Jane Snow#{can_view_investor ? " contractor+2@example.com" : nil}",
                                       "Fully diluted shares" => "621,013",
                                       "Outstanding shares" => "0",
                                       "Outstanding ownership" => "0.000%",
                                       "Fully diluted ownership" => "5.175%", # (621,013 * 100 / 12_000,000) with 3 decimals
                                       "Upcoming dividend" => "—",
                                     },
                                     {
                                       "Name" => "John Doe#{can_view_investor ? " contractor+1@example.com" : nil}",
                                       "Fully diluted shares" => "378,987",
                                       "Outstanding shares" => "0",
                                       "Outstanding ownership" => "0.000%",
                                       "Fully diluted ownership" => "3.158%", # (378,987 * 100 / 12_000,000) with 3 decimals
                                       "Upcoming dividend" => "—",
                                     },
                                     {
                                       "Name" => "Republic.co Crowd SAFE",
                                       "Fully diluted shares" => "—",
                                       "Outstanding shares" => "—",
                                       "Outstanding ownership" => "—",
                                       "Fully diluted ownership" => "—",
                                       "Upcoming dividend" => "$700,000",
                                     },
                                     {
                                       "Name" => "Options available (#{option_pool.name})",
                                       "Fully diluted shares" => "10,000,000",
                                       "Outstanding shares" => "—",
                                       "Outstanding ownership" => "—",
                                       "Fully diluted ownership" => "83.333%", # (10,000,000 * 100 / 12_000,000)
                                       "Upcoming dividend" => "—",
                                     },
                                     {
                                       "Name" => "Total",
                                       "Fully diluted shares" => "12,000,000",
                                       "Fully diluted ownership" => "100%",
                                       "Upcoming dividend" => "$1,049,913.90",
                                     }
                                   ])

        selection_assertions(can_view_investor)
      end

      it "shows the series-wise breakdown of the cap table" do
        sign_in user

        visit spa_company_cap_table_path(company.external_id)

        within(all("table").last) do
          expect(page).to have_selector("tbody > tr", count: 4)
        end

        expected_rows = [
          {
            "Series" => "Class A",
            "Outstanding shares" => "500,123",
            "Outstanding ownership" => "50.012%", # (500,123 / (500,123 + 499,877) * 100) with 3 decimals
            "Fully diluted shares" => "500,123",
            "Fully diluted ownership" => "4.168%", # (500,123 / 12,000,000 * 100) with 3 decimals
          },
          {
            "Series" => "Class B",
            "Outstanding shares" => "400,000",
            "Outstanding ownership" => "40.000%", # (400,000 / (500,123 + 499,877) * 100) with 3 decimals
            "Fully diluted shares" => "400,000",
            "Fully diluted ownership" => "3.333%", # (400,000 / 12,000,000 * 100) with 3 decimals
          },
          {
            "Series" => "Common",
            "Outstanding shares" => "99,877",
            "Outstanding ownership" => "9.988%", # (99,877 / (500,123 + 499,877) * 100) with 3 decimals
            "Fully diluted shares" => "1,099,877", # 99,877 shares + (378,987 + 621,013) options,
            "Fully diluted ownership" => "9.166%", # (1,099,877 / 12,000,000 * 100) with 3 decimals
          },
          {
            "Series" => "Options available (#{option_pool.name})",
            "Outstanding shares" => "—",
            "Outstanding ownership" => "—",
            "Fully diluted shares" => "10,000,000", # Available options
            "Fully diluted ownership" => "83.333%", # (10,000,000 / 12,000,000 * 100) with 3 decimals
          },
        ]
        expect(page).to have_table(with_rows: expected_rows)
      end

      it "does not render the upcoming dividend data if the feature is disabled" do
        sign_in user

        visit spa_company_cap_table_path(company.external_id)

        within(first("table")) do
          expect(page).to have_selector("tbody > tr", count: 6)
          expect(page).to have_selector("tfoot > tr", count: 1)
        end
        expect(page).not_to have_text("Upcoming dividend")
      end

      context "when using new schema" do
        it "shows data as expected" do
          sign_in user

          visit spa_company_cap_table_path(company.external_id, new_schema: "true")

          expect(page).to have_text("Cap table")

          within(first("table")) do
            expect(page).to have_selector("tbody > tr", count: 6)
            expect(page).to have_selector("tfoot > tr", count: 1)
          end
          expect(page).to have_table(with_rows: [
                                       {
                                         "Name" => "Flexy Founder#{can_view_investor ? " founder@example.com" : nil}",
                                         "Fully diluted shares" => "500,123",
                                         "Outstanding shares" => "500,123",
                                         "Outstanding ownership" => "50.012%", # (500,123 * 100 / (500,123 + 499,877)) with 3 decimals
                                         "Fully diluted ownership" => "4.168%", # (500,123 * 100 / 12,000,000) with 3 decimals
                                         "Notes" => "Founder",
                                       },
                                       {
                                         "Name" => "Partner Example#{can_view_investor ? " partner@example.com" : nil}",
                                         "Fully diluted shares" => "499,877",
                                         "Outstanding shares" => "499,877",
                                         "Outstanding ownership" => "49.988%", # (499,877 * 100 / (500,123 + 499,877)) with 3 decimals
                                         "Fully diluted ownership" => "4.166%", # (499,877 * 100 / 12_000,000) with 3 decimals
                                         "Notes" => "Partner",
                                       },
                                       {
                                         "Name" => "Jane Snow#{can_view_investor ? " contractor+2@example.com" : nil}",
                                         "Fully diluted shares" => "621,013",
                                         "Outstanding shares" => "0",
                                         "Outstanding ownership" => "0.000%",
                                         "Fully diluted ownership" => "5.175%", # (621,013 * 100 / 12_000,000) with 3 decimals
                                       },
                                       {
                                         "Name" => "John Doe#{can_view_investor ? " contractor+1@example.com" : nil}",
                                         "Fully diluted shares" => "378,987",
                                         "Outstanding shares" => "0",
                                         "Outstanding ownership" => "0.000%",
                                         "Fully diluted ownership" => "3.158%", # (378,987 * 100 / 12_000,000) with 3 decimals
                                       },
                                       {
                                         "Name" => "Republic.co Crowd SAFE",
                                         "Fully diluted shares" => "—",
                                         "Outstanding shares" => "—",
                                         "Outstanding ownership" => "—",
                                         "Fully diluted ownership" => "—",
                                       },
                                       {
                                         "Name" => "Options available (#{option_pool.name})",
                                         "Fully diluted shares" => "10,000,000",
                                         "Outstanding shares" => "—",
                                         "Outstanding ownership" => "—",
                                         "Fully diluted ownership" => "83.333%", # (10,000,000 * 100 / 12_000,000)
                                       },
                                       {
                                         "Name" => "Total",
                                         "Fully diluted shares" => "12,000,000",
                                         "Fully diluted ownership" => "100%",
                                       }
                                     ])

          selection_assertions(can_view_investor)
        end
      end
    end

    it "shows a message when there are no records" do
      sign_in user
      visit spa_company_cap_table_path(company.external_id)

      expect(page).to have_text("There are no active investors right now.")
    end
  end

  context "when authenticated as a company administrator" do
    let(:user) { create(:company_administrator, company:).user }
    let(:can_view_investor) { true }

    it_behaves_like "a user with access"
  end

  context "when authenticated as a company lawyer" do
    let(:user) { create(:company_lawyer, company:).user }
    let(:can_view_investor) { true }

    it_behaves_like "a user with access"
  end

  context "when authenticated as an investor" do
    let(:user) { create(:company_investor, company:).user }
    let(:can_view_investor) { false }

    it_behaves_like "a user with access"
  end
end
