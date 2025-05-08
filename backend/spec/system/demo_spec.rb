# frozen_string_literal: true

RSpec.describe "Demo mode specs" do
  describe "Demo mode" do
    context "when the feature flag is not enabled" do
      it "doesn't render demo mode elements" do
        visit root_path
        expect(page).not_to have_content("Welcome to the Flexile demo")
        expect(page).to have_content("Log into Flexile")
        expect(page).not_to have_link("Sign up")
      end
    end

    context "when the feature flag is enabled" do
      before { Flipper.enable(:demo_mode) }

      it "renders demo mode elements" do
        visit root_path
        expect(page).to have_content("Welcome to the Flexile demo")
        expect(page).not_to have_content("Log into Flexile")
        expect(page).to have_link("Sign up")
      end
    end
  end

  describe "Login" do
    let(:company) { create(:company, :completed_onboarding, name: "Demo Company") }
    let(:administrator) { company.primary_admin.user }

    context "when demo mode is not enabled" do
      before { administrator.update(password: SeedDataGeneratorFromTemplate::DEFAULT_PASSWORD) }

      it "logs in normally without demo elements" do
        visit spa_login_path
        fill_in "Email", with: administrator.email
        fill_in "Password", with: SeedDataGeneratorFromTemplate::DEFAULT_PASSWORD
        click_button "Log in"

        wait_for_ajax
        expect(page).to have_selector("h1", text: "Invoicing")
        expect(page).not_to have_link("Learn more")
        expect(page).not_to have_link("Sign up")
      end
    end

    context "when demo mode is enabled" do
      before do
        administrator.update(password: SeedDataGeneratorFromTemplate::DEFAULT_PASSWORD)
        ENV["DEFAULT_DEMO_COMPANY_ID"] = company.id.to_s
      end

      it "logs in using demo company and shows demo elements" do
        visit spa_login_path

        within(:table_row, { "Demo Company" => "#{administrator.display_name}Administrator" }) do
          click_on "Log in"
        end

        wait_for_ajax
        expect(page).to have_selector("h1", text: "Invoicing")
        expect(page).to have_link("Learn more")
        expect(page).to have_link("Sign up")
      end
    end
  end
end
