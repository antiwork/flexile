# frozen_string_literal: true

RSpec.describe "Equity Grants list page" do
  let(:company) { create(:company) }

  shared_examples "an administrator with access" do
    before { company.update!(equity_enabled: true) }

    context "when records exist" do
      before do
        create(:equity_grant, year: 2018,
                              number_of_shares: 1_129,
                              vested_shares: 501,
                              unvested_shares: 499,
                              exercised_shares: 129,
                              company_investor: create(:company_investor, company:, user: create(:user, country_code: "DE")),
                              share_price_usd: 10.10,
                              exercise_price_usd: 5.34,
                              option_holder_name: "Jack")
        create(:equity_grant, year: 2019,
                              number_of_shares: 2_373,
                              vested_shares: 1_433,
                              exercised_shares: 373,
                              unvested_shares: 567,
                              company_investor: create(:company_investor, company:, user: create(:user, country_code: "PT")),
                              share_price_usd: 20.20,
                              exercise_price_usd: 10.68,
                              accepted_at: nil,
                              option_holder_name: "Jill")

        sign_in user
      end

      def assert_first_grant_row
        within(:table_row, { "Granted" => "2,373", "Left to vest" => "567", "Exercised" => "373", "Exercise price" => "$10.68", "Vested options value" => "$28,946.60" }) do
          expect(page).to have_text(:all, "Vested1,433") # would match "Vested options value" if included above
          expect(page).to have_link("Jill")
        end
      end

      def assert_second_grant_row
        within(:table_row, { "Granted" => "1,129", "Left to vest" => "499", "Exercised" => "129", "Exercise price" => "$5.34", "Vested options value" => "$5,060.10" }) do
          expect(page).to have_text(:all, "Vested501", normalize_ws: true) # would match "Vested options value" if included above
          expect(page).to have_link("Jack")
        end
      end

      it "lists grant details for the company" do
        visit spa_company_equity_grants_path(company.external_id)

        # Tab heading
        expect(page).to have_text("Equity")

        # Stats
        # 501 + 1,433 (vested) + 499 + 567 (unvested) + 129 + 373 (exercised)
        expect(find("figure", text: "Granted")).to have_text("3,502")
        expect(find("figure", text: "Vested")).to have_text("1,934") # 501 + 1,433
        expect(find("figure", text: "Left to vest")).to have_text("1,066") # 499 + 567

        # Table
        assert_first_grant_row
        assert_second_grant_row

        # Countries of option grant holders
        expect(page).to have_table(with_rows: [
                                     {
                                       "Country" => "Germany",
                                       "Number of option holders" => "1",
                                     },
                                     {
                                       "Country" => "Portugal",
                                       "Number of option holders" => "1",
                                     }
                                   ])
      end

      it "allows pagination" do
        # Pagination
        stub_const("EquityGrantsPresenter::RECORDS_PER_PAGE", 1)

        visit spa_company_equity_path(company.external_id)
        expect(page).to have_text("Showing 1-1 of 2")
        assert_first_grant_row

        click_on "2"
        expect(page).to have_text("Showing 2-2 of 2")
        assert_second_grant_row
      end
    end

    it "shows a message when there are no records" do
      sign_in user
      visit spa_company_equity_path(company.external_id)

      expect(page).to have_text("There are no option grants right now.")
    end
  end

  context "when authenticated as a company administrator" do
    let(:user) { create(:company_administrator, company:).user }

    it_behaves_like "an administrator with access"
  end

  context "when authenticated as a company lawyer" do
    let(:user) { create(:company_lawyer, company:).user }

    it_behaves_like "an administrator with access"
  end

  context "when authenticated as an investor" do
    let(:company) do
      create(:company, valuation_in_dollars: 100_000_000, share_price_in_usd: 11.377302054854524127275602627246590507)
    end
    let(:company_investor) { create(:company_investor, company:) }
    let(:user) { company_investor.user }
    let!(:company_worker) { create(:company_worker, company: company, user:) }
    let!(:company_administrator) { create(:company_administrator, company: company) }

    before do
      create(:equity_exercise_bank_account, company:)
      create(:equity_grant, year: 2017,
                            number_of_shares: 5_000,
                            vested_shares: 0,
                            exercised_shares: 5_000,
                            company_investor:,
                            share_price_usd: 3.17,
                            exercise_price_usd: 2.57,
                            issued_at: DateTime.parse("March 4 2017"),
                            board_approval_date: Date.new(2017, 3, 1))
      create(:equity_grant, year: 2018,
                            number_of_shares: 1_000,
                            vested_shares: 501,
                            unvested_shares: 499,
                            company_investor:,
                            share_price_usd: 10.10,
                            exercise_price_usd: 5.34,
                            issued_at: DateTime.parse("March 4 2018"),
                            board_approval_date: Date.new(2018, 3, 1),
                            voluntary_termination_exercise_months: 1,
                            involuntary_termination_exercise_months: 3,
                            termination_with_cause_exercise_months: 0,
                            death_exercise_months: 18,
                            disability_exercise_months: 12,
                            retirement_exercise_months: 3)
      create(:equity_grant, year: 2019,
                            number_of_shares: 2_000,
                            vested_shares: 1_433,
                            unvested_shares: 567,
                            company_investor:,
                            share_price_usd: 20.20,
                            exercise_price_usd: 10.68,
                            issue_date_relationship: :employee,
                            option_grant_type: :iso,
                            issued_at: DateTime.parse("March 4 2019"),
                            board_approval_date: Date.new(2019, 3, 1))
      create(:equity_grant, year: 2020,
                            company_investor:,
                            issued_at: DateTime.parse("March 4 2020"),
                            accepted_at: nil)

      sign_in user
      company.update!(equity_enabled: true)
      Flipper.enable(:option_exercising, company)
    end

    it "lists grant details for an investor", :freeze_time do
      visit spa_company_equity_path(company.external_id)

      # Section headings
      expect(page).to have_text("Equity")
      expect(page).to have_text("2 stock option grants")

      expect(page).not_to have_link("Shares")
      expect(page).not_to have_link("Convertibles")

      # Stats
      expect(find("figure", text: "Total shares owned")).to have_text("3,000")
      expect(find("figure", text: "Share value")).to have_text("$11.38")
      expect(find("figure", text: "Vested equity value ($100M valuation)")).to have_text("$34,006.70")

      expect(page).to have_text("You have 1,934 vested options available for exercise.")
      expect(page).to have_button("Exercise Options")

      # Table
      within(:table_row, { "Period" => "2018", "Granted options" => "1,000", "Exercise price" => "$5.34", "Available for vesting" => "499", "Vested options value" => "$5,060.10" }) do
        expect(page).to have_text(:all, "Vested options501") # would match "Vested options value" if included above
        page.click
      end
      within "dialog" do
        expect(page).to have_text("Options received 1,000 (NSO)", normalize_ws: true)
        expect(page).to have_text("Available for vesting 499", normalize_ws: true)
        expect(page).to have_text("Vest before Dec 31, 2018", normalize_ws: true)
        expect(page).to have_text("Available for exercising 501", normalize_ws: true)
        expect(page).to have_text("Status Outstanding", normalize_ws: true)
        expect(page).to have_text("Exercise price $5.34", normalize_ws: true)
        expect(page).to have_text("Full exercise cost $2,675.34", normalize_ws: true) # 501 * $5.34
        expect(page).to have_text("Grant date Mar 4, 2018", normalize_ws: true)
        expect(page).to have_text("Expiration date Mar 4, 2028", normalize_ws: true)
        expect(page).to have_text(%Q{Accepted on #{Date.current.strftime("%b %-d, %Y")}}, normalize_ws: true)
        expect(page).to have_text("Voluntary termination 1 month", normalize_ws: true)
        expect(page).to have_text("Involuntary termination 3 months", normalize_ws: true)
        expect(page).to have_text("Termination with cause 0 days", normalize_ws: true)
        expect(page).to have_text("Death 1 year 6 months", normalize_ws: true)
        expect(page).to have_text("Disability 1 year", normalize_ws: true)
        expect(page).to have_text("Retirement 3 months", normalize_ws: true)
        expect(page).to have_text("Board approval date Mar 1, 2018", normalize_ws: true)
        expect(page).to have_text("State/Country of Residency NY, United States", normalize_ws: true)
        expect(page).to have_text("Relationship to company Consultant", normalize_ws: true)
        expect(page).to have_button("Exercise options")
        click_on "Download"
        expect(page).to have_button("Downloading, please wait...", disabled: true)
        wait_for_ajax
        expect(page).to have_button("Download")
        click_on "Close"
      end

      within(:table_row, { "Period" => "2019", "Granted options" => "2,000", "Exercise price" => "$10.68", "Available for vesting" => "567", "Vested options value" => "$28,946.60" }) do
        expect(page).to have_text(:all, "Vested options1,433") # would match "Vested options value" if included above
        page.click
      end
      within "dialog" do
        expect(page).to have_text("2019 Stock Option Grant")
        expect(page).to have_text("Options received 2,000 (ISO)", normalize_ws: true)
        expect(page).to have_text("Available for vesting 567", normalize_ws: true)
        expect(page).to have_text("Vest before Dec 31, 2019", normalize_ws: true)
        expect(page).to have_text("Available for exercising 1,433", normalize_ws: true)
        expect(page).to have_text("Status Outstanding", normalize_ws: true)
        expect(page).to have_text("Exercise price $10.68", normalize_ws: true)
        expect(page).to have_text("Full exercise cost $15,304.44", normalize_ws: true) # 1433 * $10.68
        expect(page).to have_text("Grant date Mar 4, 2019", normalize_ws: true)
        expect(page).to have_text("Expiration date Mar 4, 2029", normalize_ws: true)
        expect(page).to have_text(%Q{Accepted on #{Date.current.strftime("%b %-d, %Y")}}, normalize_ws: true)
        expect(page).to have_text("Board approval date Mar 1, 2019", normalize_ws: true)
        expect(page).to have_text("Voluntary termination 10 years", normalize_ws: true)
        expect(page).to have_text("Involuntary termination 10 years", normalize_ws: true)
        expect(page).to have_text("Termination with cause 0 days", normalize_ws: true)
        expect(page).to have_text("Death 10 years", normalize_ws: true)
        expect(page).to have_text("Disability 10 years", normalize_ws: true)
        expect(page).to have_text("Retirement 10 years", normalize_ws: true)
        expect(page).to have_text("State/Country of Residency NY, United States", normalize_ws: true)
        expect(page).to have_text("Relationship to company Employee", normalize_ws: true)
        expect(page).to have_button("Exercise options")
        click_on "Close"
      end

      expect(page).to_not have_selector(:table_row, { "Period" => "2020" }) # The grant isn't signed yet

      # Pagination
      stub_const("EquityGrantsPresenter::RECORDS_PER_PAGE", 1)
      visit spa_company_equity_path(company.external_id)
      expect(page).to have_text("Showing 1-1 of 2")
    end

    it "does not show the exercise button if the feature is disabled" do
      Flipper.disable(:option_exercising, company)
      user.update!(country_code: "JP")

      visit spa_company_equity_path(company.external_id)

      expect(page).to have_text("2 stock option grants")
      expect(page).not_to have_button("Exercise Options")
      find(:table_row, { "Period" => "2019" }).click
      within "dialog" do
        expect(page).to have_text("Options received 2,000 (ISO)", normalize_ws: true)
        expect(page).to have_text("Available for vesting 567", normalize_ws: true)
        expect(page).to have_text("Vest before Dec 31, 2019", normalize_ws: true)
        expect(page).to have_text("Available for exercising 1,433", normalize_ws: true)
        expect(page).to have_text("Status Outstanding", normalize_ws: true)
        expect(page).to have_text("Exercise price $10.68", normalize_ws: true)
        expect(page).to have_text("Full exercise cost $15,304.44", normalize_ws: true) # 1433 * $10.68
        expect(page).to have_text("Grant date Mar 4, 2019", normalize_ws: true)
        expect(page).to have_text("Expiration date Mar 4, 2029", normalize_ws: true)
        expect(page).to have_text("Board approval date Mar 1, 2019", normalize_ws: true)
        expect(page).to have_text("State/Country of Residency Japan", normalize_ws: true)
        expect(page).to have_text("Relationship to company Employee", normalize_ws: true)
        expect(page).not_to have_button("Exercise options")
        click_on "Close"
      end
    end

    it "allows the user to begin the process of exercising options" do
      visit spa_company_equity_path(company.external_id)

      # Section headings
      expect(page).to have_text("Equity")
      expect(page).to have_text("2 stock option grants")

      expect(page).to have_text("You have 1,934 vested options available for exercise.")
      expect(page).to have_button("Exercise Options")

      find(:table_row, { "Period" => "2019" }).click
      within "dialog" do
        expect(page).to have_text("2019 Stock Option Grant")
        expect(page).to have_text("Options received 2,000 (ISO)", normalize_ws: true)
        expect(page).to have_text("Available for vesting 567", normalize_ws: true)
        expect(page).to have_text("Vest before Dec 31, 2019", normalize_ws: true)
        expect(page).to have_text("Available for exercising 1,433", normalize_ws: true)
        expect(page).to have_text("Status Outstanding", normalize_ws: true)
        expect(page).to have_text("Exercise price $10.68", normalize_ws: true)
        expect(page).to have_text("Full exercise cost $15,304.44", normalize_ws: true) # 1433 * $10.68
        expect(page).to have_text("Grant date Mar 4, 2019", normalize_ws: true)
        expect(page).to have_text("Expiration date Mar 4, 2029", normalize_ws: true)
        expect(page).to have_text("Board approval date Mar 1, 2019", normalize_ws: true)
        expect(page).to have_text("State/Country of Residency NY, United States", normalize_ws: true)
        expect(page).to have_text("Relationship to company Employee", normalize_ws: true)
        click_on "Exercise options"
      end
      within "dialog" do
        expect(page).to have_text("Exercise your options")
        expect(page).to have_field("Options to exercise", with: "1")
        expect(page).to have_text("2019 Grant at $10.68 / share", normalize_ws: true)
        expect(page).to have_text("1 of 1,433", normalize_ws: true)
        expect(page).to have_selector("h3", text: "Summary")
        expect(page).to have_text("Exercise cost $10.68", normalize_ws: true)
        expect(page).to have_text("Payment method Bank transfer", normalize_ws: true)
        expect(page).to have_text("Options value Based on 100M valuation $11.38 6.53%", normalize_ws: true)

        fill_in "Options to exercise", with: "567"
        expect(page).to have_text("567 of 1,433", normalize_ws: true)
        expect(page).to have_text("Exercise cost $6,055.56", normalize_ws: true) # 567 * $10.68
        expect(page).to have_text("Options value Based on 100M valuation $6,450.93 6.53%", normalize_ws: true) # 567 * $11.38

        expect(page).to have_button("Proceed")

        expect do
          click_on "Proceed"
          wait_for_ajax
        end.to change { company_investor.equity_grant_exercises.count }.by(1)

        expect(page).to have_current_path(spa_company_equity_grant_exercise_path(company.external_id, company_investor.equity_grant_exercises.last.id))
      end
    end

    it "allows exercising multiple grants at once" do
      visit spa_company_equity_path(company.external_id)

      expect(page).to have_text("You have 1,934 vested options available for exercise.")
      click_on "Exercise Options"
      expect(page).to have_text("Exercise your options")
      expect(page).to have_field("Options to exercise", with: "1")

      expect(page).to have_checked_field("2018 Grant at $5.34 / share")
      expect(page).to have_text("1 of 501", normalize_ws: true)

      expect(page).to have_checked_field("2019 Grant at $10.68 / share")
      expect(page).to have_text("0 of 1,433", normalize_ws: true)

      expect(page).to have_text("Exercise cost $5.34", normalize_ws: true)
      expect(page).to have_text("Payment method Bank transfer", normalize_ws: true)
      expect(page).to have_text("Options value Based on 100M valuation $11.38 113.06%", normalize_ws: true)

      fill_in "Options to exercise", with: "1600"
      expect(page).to have_text("501 of 501", normalize_ws: true)
      expect(page).to have_text("1,099 of 1,433", normalize_ws: true)
      expect(page).to have_text("Exercise cost $14,412.66", normalize_ws: true) # 501 * $5.34 + 1099 * $10.68
      expect(page).to have_text("Options value Based on 100M valuation $18,203.68 26.3%", normalize_ws: true) # 501 * $11.38 + 1099 * $11.38

      expect(page).to have_button("Proceed")

      expect do
        click_on "Proceed"
        wait_for_ajax
      end.to change { company_investor.equity_grant_exercises.count }.by(1)

      exercise_id = company_investor.equity_grant_exercises.last.id
      expect(page).to have_current_path(spa_company_equity_grant_exercise_path(company.external_id, exercise_id))

      expect(page).to have_selector("h1", text: "Stock Option Exercise Agreement")
      click_on "Click to add signature"
      click_on "Sign and submit"

      expect(page).to have_current_path(spa_company_equity_grant_exercise_account_path(company.external_id, exercise_id))
      expect(page).to have_selector("h1", text: "Pay with bank transfer")
      expect(page).to have_text("A copy of these instructions have been sent to your email.")
      expect(page).to have_text("Total to pay $14,412.66", normalize_ws: true)
      expect(page).to have_text("Account number 0123456789", normalize_ws: true)
      expect(page).to have_text("Beneficiary name #{company.name}", normalize_ws: true)
      expect(page).to have_text("Beneficiary address 548 Market Street, San Francisco, CA 94104", normalize_ws: true)
      expect(page).to have_text("Bank name Mercury Business", normalize_ws: true)
      expect(page).to have_text("Routing number 987654321", normalize_ws: true)
      expect(page).to have_text("SWIFT/BIC WZYOPW1L", normalize_ws: true)
      expect(page).to have_link("Back to Equity", href: spa_company_equity_path(company.external_id))

      click_on "Back to Equity"
      expect(page).to_not have_button("Exercise Options")
      expect(page).to have_text("We're awaiting a payment of $14,412.66 to exercise 1,600 options")
      expect(page).to have_link("Payment instructions")
    end

    it "disallows exercising grants that have expired or when an in-progress exercise exists" do
      grant_2018 = EquityGrant.where("EXTRACT(YEAR FROM issued_at) = 2018").sole
      active_exercise = create(:equity_grant_exercise, :signed, equity_grants: [grant_2018], total_cost_cents: 11_233_89,
                                                                company_investor:, number_of_options: 500)
      grant_2018.update!(active_exercise:)
      grant_2019 = EquityGrant.where("EXTRACT(YEAR FROM issued_at) = 2019").sole
      grant_2019.update!(expires_at: Time.current)
      grant_2020 = EquityGrant.where("EXTRACT(YEAR FROM issued_at) = 2020").sole
      grant_2020.update!(issued_at: DateTime.parse("March 4, 2020"), board_approval_date: Date.new(2020, 3, 1), accepted_at: Time.current)

      visit spa_company_equity_path(company.external_id)

      # Section headings
      expect(page).to have_text("Equity")
      expect(page).to have_text("3 stock option grants")

      expect(page).to_not have_text("You have 2,034 vested options available for exercise.")
      expect(page).to_not have_button("Exercise Options")
      expect(page).to have_text("We're awaiting a payment of $11,233.89 to exercise 500 options")
      expect(page).to have_link("Payment instructions", href: spa_company_equity_grant_exercise_account_path(company.external_id, active_exercise.id))

      # No exercising buttons are shown for the 2020 grant because another grant has an exercise in progress
      find(:table_row, { "Period" => "2020" }).click
      within "dialog" do
        expect(page).to have_button("Download")
        expect(page).not_to have_button("Exercise options")
        click_on "Close"
      end

      # No exercising buttons are shown for the 2019 grant because it has expired
      find(:table_row, { "Period" => "2019" }).click
      within "dialog" do
        expect(page).to have_button("Download")
        expect(page).not_to have_button("Exercise options")
        click_on "Close"
      end

      # No exercising buttons are shown for the 2018 grant because it has an exercise in progress
      find(:table_row, { "Period" => "2018" }).click
      within "dialog" do
        expect(page).to have_text("Status Outstanding", normalize_ws: true)
        expect(page).to have_text("Relationship to company Consultant", normalize_ws: true)
        expect(page).to have_button("Download")
        expect(page).not_to have_button("Exercise options")
        click_on "Close"
      end
    end

    it "shows the 'Shares' and 'Convertibles' tabs if records exist" do
      create(:convertible_security, company_investor:)
      create(:share_holding, company_investor:)

      visit spa_company_equity_path(company.external_id)

      expect(page).to have_link("Shares", href: spa_company_shares_path(company.external_id))
      expect(page).to have_link("Convertibles", href: spa_company_convertibles_path(company.external_id))
    end
  end
end
