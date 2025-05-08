# frozen_string_literal: true

RSpec.describe "Payouts settings", :vcr do
  include ActionView::Helpers::NumberHelper
  include WiseHelpers

  let!(:country_code) { "US" }
  let!(:user) do
    user = create(:user, :without_compliance_info, country_code:, legal_name: "Janet C. Flexile",
                                                   email: "janet@flexile.com", birth_date: Date.new(1980, 6, 27))
    create(:user_compliance_info, user:, tax_id: "123-45-6789")
    user
  end

  before { sign_in user }

  describe "Dividends section" do
    let!(:company_investor) { create(:company_investor, user:) }

    it "allows editing dividend payout amount" do
      visit spa_settings_payouts_path
      wait_for_ajax

      within_section "Dividends", section_element: :form do
        fill_in "Minimum dividend payout amount", with: 999
        click_on "Save changes"
        wait_for_ajax
      end
      expect(company_investor.user.reload.minimum_dividend_payment_in_cents).to eq(999_00)
    end
  end

  def fill_out_bank_account_form
    select_wise_field "CAD (Canadian Dollar)", from: "Currency"
    fill_in "Full name of the account holder", with: "Greg Mapleleaf"
    fill_in "Institution number", with: "006"
    fill_in "Transit number", with: "04841"
    fill_in "Account number", with: "3456712"
    within_modal do
      click_on "Continue"
    end
    select "Canada", from: "Country"
    fill_in "City", with: "Calgary"
    fill_in "Street address, apt number", with: "222 Leaf St"
    select "Alberta", from: "Province"
    wait_for_ajax
    fill_in "Post code", with: "A2A 2A2"
  end

  describe "Bank accounts section" do
    shared_examples_for "common assertions" do
      context "updating bank information", :vcr do
        let(:country_code) { "AE" }

        it "pre-fills existing bank information" do
          visit spa_settings_payouts_path
          expect(page).to have_text("in 1234")
          expect(page).to have_text("USD")

          click_on "Edit"
          expect(page).to have_select("Currency", selected: "USD (United States Dollar)")
          expect(page).to have_field("Full name of the account holder", with: "John Banker")
          expect(page).to have_field("ACH routing number", with: "026009593")
          expect(page).to have_field("Account number", with: "87654321")
          expect(page).to have_checked_field("Savings")
          within_modal do
            click_on "Continue"
          end
          expect(page).to have_field("Country", with: "United States")
          expect(page).to have_field("City", with: "Tallahassee")
          expect(page).to have_field("Street address, apt number", with: "1234 Orange Street")
          expect(page).to have_field("State", with: "Hawaii")
          expect(page).to have_field("ZIP code", with: "32308")
        end

        it "allows updating to a Canada-based bank account" do
          user.bank_account.update!(recipient_id: "148912976")

          visit spa_settings_payouts_path
          click_on "Edit"
          wait_for_ajax
          fill_out_bank_account_form
          wait_for_ajax
          click_on "Save bank account"
          wait_for_ajax

          expect(page).to have_text("in 6712")
          expect(page).to have_text("CAD")

          click_on "Edit"
          within_modal do
            expect(page).to have_text "Full name of the account holder" # resets the active step of the modal
          end
        end

        it "allows updating to a Romania-based bank account" do
          user.bank_account.update!(recipient_id: "148910337")

          visit spa_settings_payouts_path
          wait_for_ajax
          click_on "Edit"
          select_wise_field "RON (Romanian Leu)", from: "Currency"
          fill_in "Full name of the account holder", with: "Andrei Popescu"
          fill_in "IBAN", with: "RO02 BREL OMKC A8QZ KIW4 X7RG"
          wait_for_ajax
          within_modal do
            click_on "Continue"
          end
          select_wise_field "Romania", from: "Country"
          fill_in "City", with: "Bucharest"
          fill_in "Street address, apt number", with: "Calea Vitan Nr. 6-6A"
          fill_in "Post code", with: "031296"

          click_on "Save bank account"
          wait_for_ajax

          expect(page).to have_text("in X7RG")
          expect(page).to have_text("RON")
        end

        it "allows updating to a Ghana-based bank account" do
          user.bank_account.update!(recipient_id: "148563324")

          wait_for_ajax
          visit spa_settings_payouts_path
          wait_for_ajax
          click_on "Edit"
          select_wise_field "GHS (Ghanaian Cedi)", from: "Currency"
          fill_in "Full name of the account holder", with: "Chris Banker"
          select "Bank of Ghana", from: "Bank name"
          select "Accra [GH010101]", from: "Branch name"
          wait_for_ajax
          fill_in "Account number", with: "12345678"
          wait_for_ajax
          within_modal do
            click_on "Continue"
          end
          select "Ghana", from: "Country"
          expect(page).not_to have_field("State")
          expect(page).not_to have_field("Post code")
          fill_in "City", with: "Accra"
          wait_for_ajax
          fill_in "Street address, apt number", with: "No. F556/I"
          wait_for_ajax

          click_on "Save bank account"
          wait_for_ajax

          expect(page).to have_text("in 5678")
          expect(page).to have_text("GHS")
        end
      end
    end

    context "as a contractor" do
      let(:company) { create(:company) }
      let!(:company_worker) { create(:company_worker, company:, user:) }

      it "can navigate to the page from the nav bar" do
        visit spa_company_invoices_path(company.external_id)
        click_on "Account"
        expect(page).to have_link("Settings", href: spa_settings_path())
        select_tab "Payouts"
        expect(page).to have_text("USD")
        expect(page).to have_text("in 1234")
      end

      it "renders the Tax info page under Account" do
        visit spa_company_invoices_path(company.external_id)
        click_on "Account"
        expect(page).to have_link("Settings", href: spa_settings_path())
        expect(page).to have_link("Tax info", href: spa_settings_tax_path())
      end

      it "does not allow adding another bank account" do
        visit spa_settings_payouts_path
        expect(page).to have_selector("h1", text: "Profile")
        expect(page).not_to have_text("Add bank account")
      end

      include_examples "common assertions"
    end

    context "as an investor" do
      let!(:company_investor) { create(:company_investor, user:) }
      let(:company) { company_investor.company }

      it "can navigate to the page from the nav bar" do
        visit spa_company_dividends_path(company_investor.company.external_id)
        click_on "Account"
        expect(page).to have_link("Settings", href: spa_settings_path())
        select_tab "Payouts"
        expect(page).to have_text("USD")
        expect(page).to have_text("in 1234")
      end

      it "renders the Tax info page under Account" do
        visit spa_company_dividends_path(company_investor.company.external_id)
        click_on "Account"
        expect(page).to have_link("Settings", href: spa_settings_path())
        expect(page).to have_link("Tax info", href: spa_settings_tax_path())
      end

      include_examples "common assertions"

      context "when investor is from a sanctioned country" do
        let(:country_code) { "CU" }

        it "displays a payout disabled banner and does not allow updating bank account" do
          visit spa_settings_payouts_path

          expect(page).to_not have_text("in 1234")
          expect(page).to have_selector("strong", text: "Payouts are disabled")
          expect(page).to have_text("Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform.")
        end
      end

      context "when investor is from a restricted country" do
        let(:country_code) { "BR" }

        context "when investor has a bank account" do
          it "allows updating their bank account" do
            visit spa_settings_payouts_path
            expect(page).to have_text("in 1234")
            expect(page).to have_text("USD")

            click_on "Edit"
            within_modal do
              expect(page).to have_select("Currency", selected: "USD (United States Dollar)")
              expect(page).to have_field("Full name of the account holder", with: "John Banker")
              expect(page).to have_field("ACH routing number", with: "026009593")
              expect(page).to have_field("Account number", with: "87654321")
              expect(page).to have_checked_field("Savings")

              fill_in "Account number", with: "12345678"
              click_on "Continue"

              select_wise_field "United States", from: "Country"
              fill_in "City", with: user.city
              fill_in "Street address, apt number", with: "59-720 Kamehameha Hwy"
              select "Hawaii", from: "State"
              wait_for_ajax
              fill_in "ZIP code", with: "96712"
              click_on "Save bank account"
            end

            expect(page).to have_text("in 5678")
          end
        end

        context "when investor has a wallet address" do
          before do
            create(:wallet, user:)
            user.bank_accounts.destroy_all
            visit spa_settings_payouts_path
          end

          it "allows updating their ETH wallet address" do
            expect(page).to have_selector("h2", text: "Payout method")
            expect(page).to have_selector("h2", text: "ETH wallet")
            expect(page).to have_text("0x1234f5ea0ba39494ce839613fffba74279579268")

            click_on "Edit"

            within_modal do
              fill_in "Ethereum wallet address (ERC20 Network)", with: "invalidETH"
              click_on "Save"
              expect(page).to have_text("The entered address is not a valid Ethereum address.")

              fill_in "Ethereum wallet address (ERC20 Network)", with: "0x1234f5ea0ba39494ce839613fffba74279579269"
              click_on "Save"
            end

            expect(page).to_not have_text("0x1234f5ea0ba39494ce839613fffba74279579268")
            expect(page).to have_text("0x1234f5ea0ba39494ce839613fffba74279579269")
          end

          it "allows adding a bank account and using it for dividends" do
            click_on "Add bank account"
            fill_out_bank_account_form
            click_on "Save bank account"
            wait_for_ajax
            expect(page).to have_text("in 6712")
          end
        end

        it "allows adding another bank account and using it for dividends" do
          visit spa_settings_payouts_path
          wait_for_ajax

          existing_bank_accounts = user.bank_accounts.alive
          expect(existing_bank_accounts.size).to eq 1
          existing_bank_account = existing_bank_accounts.first
          expect(existing_bank_account.used_for_invoices).to eq true
          expect(existing_bank_account.used_for_dividends).to eq true

          click_on "Add bank account"
          fill_out_bank_account_form
          wait_for_ajax
          click_on "Save bank account"
          wait_for_ajax

          updated_bank_accounts = user.bank_accounts.alive.order(:id)
          expect(updated_bank_accounts.size).to eq 2
          new_bank_account = updated_bank_accounts.last
          expect(new_bank_account.last_four_digits).to eq "6712"
          expect(new_bank_account.used_for_invoices).to eq false
          expect(new_bank_account.used_for_dividends).to eq false

          expect(page).to have_text("in #{existing_bank_account.last_four_digits}")
          expect(page).to have_text("in 6712")

          within("#bank-account-#{existing_bank_account.id}") do
            expect(page).to have_text("used for invoices, dividends")
          end
          within("#bank-account-#{new_bank_account.id}") do
            expect(page).not_to have_text("used for")
            click_on "Use for dividends"
          end
          wait_for_ajax

          existing_bank_account.reload
          expect(existing_bank_account.used_for_invoices).to eq true
          expect(existing_bank_account.used_for_dividends).to eq false
          within("#bank-account-#{existing_bank_account.id}") do
            expect(page).to have_text("used for invoices")
          end

          new_bank_account.reload
          expect(new_bank_account.used_for_invoices).to eq false
          expect(new_bank_account.used_for_dividends).to eq true
          within("#bank-account-#{new_bank_account.id}") do
            expect(page).to have_text("used for dividends")
          end
        end
      end
    end
  end
end
