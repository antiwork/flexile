# frozen_string_literal: true

RSpec.shared_examples_for "verifying Stripe microdeposits" do
  include StripeHelpers

  before { sign_in admin_user }

  context "when microdeposit verification is not needed" do
    before { allow_any_instance_of(Company).to receive(:microdeposit_verification_required?).and_return(false) }

    it "does not display info about microdeposit verification" do
      visit path
      expect(page).not_to have_content "Verify your bank account to enable contractor payments"
    end
  end

  context "when microdeposit verification is pending", :vcr do
    before do
      company.bank_account.update!(status: CompanyStripeAccount::ACTION_REQUIRED, bank_account_last_four: nil)
      setup_company_on_stripe(company, verify_with_microdeposits: true)
    end

    context "via descriptor code" do
      it "allows verifying microdeposits" do
        visit path

        expect(page).to have_content "Verify your bank account to enable contractor payments"
        click_on "Verify bank account"

        within("dialog") do
          expect(page).to have_content "Verify your bank account"
          expect(page).to have_content "Check your bank account for a $0.01 deposit from Stripe on #{arrival_date}"
          fill_in "6-digit code", with: "SM1"
          click_on "Submit"
          expect(page).to have_field("6-digit code", valid: false)
          expect(page).to have_content "Please enter a 6-digit code."

          fill_in "6-digit code", with: "SM11AA"
          expect(page).to have_field("6-digit code", valid: true)
          click_on "Submit"
        end

        expect(page).not_to have_content "Verify your bank account to enable contractor payments"
      end

      it "returns an error for an invalid code" do
        visit path

        expect(page).to have_content "Verify your bank account to enable contractor payments"
        click_on "Verify bank account"

        within("dialog") do
          expect(page).to have_content "Verify your bank account"
          expect(page).to have_content "Check your bank account for a $0.01 deposit from Stripe on #{arrival_date}"
          fill_in "6-digit code", with: "SM33CC"
          click_on "Submit"
          wait_for_ajax
          expect(page).to have_field("6-digit code", valid: false)
          expect(page).to have_content "You have exceeded the number of allowed verification attempts."
        end
      end
    end

    context "via amounts" do
      before do
        details = company.microdeposit_verification_details
        allow_any_instance_of(Company).to receive(:microdeposit_verification_details).and_return(details.merge(microdeposit_type: "amounts"))
      end

      it "allows verifying microdeposits" do
        visit path

        expect(page).to have_content "Verify your bank account to enable contractor payments"
        click_on "Verify bank account"

        within("dialog") do
          expect(page).to have_content "Verify your bank account"
          expect(page).to have_content "Check your bank account for two deposits from Stripe on #{arrival_date}. The transactions' description will read \"ACCTVERIFY\"."
          fill_in "Amount 1", with: "0.32"
          click_on "Submit"
          expect(page).to have_field("Amount 2", valid: false)
          fill_in "Amount 2", with: "0.45"
          expect(page).to have_field("Amount 2", valid: true)
          click_on "Submit"
        end

        expect(page).not_to have_content "Verify your bank account to enable contractor payments"
      end

      it "raises an error for an invalid code" do
        visit path

        expect(page).to have_content "Verify your bank account to enable contractor payments"
        click_on "Verify bank account"

        within("dialog") do
          expect(page).to have_content "Verify your bank account"
          expect(page).to have_content "Check your bank account for two deposits from Stripe on #{arrival_date}. The transactions' description will read \"ACCTVERIFY\"."
          fill_in "Amount 1", with: "0.10"
          fill_in "Amount 2", with: "0.11"
          click_on "Submit"
          wait_for_ajax
          expect(page).to have_field("Amount 1", valid: false)
          expect(page).to have_field("Amount 2", valid: false)
          expect(page).to have_content "You have exceeded the number of allowed verification attempts."
        end
      end
    end

    it "opens the modal by default with query param" do
      visit "#{path}?open-modal=microdeposits"

      within("dialog") do
        expect(page).to have_content "Verify your bank account"
      end
    end
  end
end
