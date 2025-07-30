# frozen_string_literal: true

RSpec.describe "Main navigation" do
  let(:company) { create(:company) }
  let(:company_worker) { create(:company_worker, company:) }
  let(:company_administrator) { create(:company_administrator, company:) }
  let(:company_lawyer) { create(:company_lawyer, company:) }
  let!(:company_investor) { create(:company_investor, company:) }

  context "when the user is a contractor" do
    it "renders the expected navigation links" do
      sign_in company_worker.user
      visit root_path

      expect(page).to have_link("Invoices")
      expect(page).to have_link("Tracking")
      expect(page).to have_link("Documents")
      expect(page).to have_link("Account")
      expect(page).to_not have_link("People")
      expect(page).to_not have_link("Updates")
      expect(page).to_not have_link("Expenses")
      expect(page).to_not have_link("Settings")

      company_worker.update!(ended_at: Time.current)
      visit root_path
      expect(page).to_not have_link("People")

      company_worker.update!(ended_at: nil, company:)
      visit root_path
      expect(page).to_not have_link("People")

      company.update!(equity_enabled: true)
      company.is_gumroad = true
      company.save!
      visit root_path
      expect(page).to have_link("Equity")

      Flipper.enable(:company_updates, company)
      visit root_path
      click_on "Updates"
      expect(page).to have_current_path(spa_company_updates_company_index_path(company.external_id))
      expect(page).to have_link("Analytics")
      Flipper.disable(:company_updates, company)

      company_worker.update_column(:pay_rate_type, "project_based")
      visit root_path
      expect(page).to_not have_link("Tracking")
      expect(page).to_not have_link("Equity")

      company.update!(expense_cards_enabled: true)
      visit root_path
      expect(page).to have_link("Expenses")

      company_worker.update!(ended_at: Time.current)
      visit root_path
      expect(page).to_not have_link("Analytics")
    end

    context "when the contractor can change equity settings" do
      let(:company_worker) { create(:company_worker, company:, pay_rate_type: :hourly) }

      before do
        company.update!(equity_enabled: true)
        sign_in company_worker.user
      end

      it "renders the settings navigation link" do
        visit root_path
        expect(page).to have_link("Settings")
      end
    end

    context "when the contractor is also an investor" do
      before do
        create(:company_investor, company:, user: company_worker.user)
        sign_in company_worker.user
      end

      it "renders the expected navigation links" do
        visit root_path
        expect(page).to have_link("Invoices")
        expect(page).not_to have_link("Expenses")
        expect(page).to have_link("Tracking")
        expect(page).to have_link("Documents")
        expect(page).to_not have_link("People")
        expect(page).to_not have_link("Analytics")
        expect(page).to have_link("Equity")
        expect(page).to have_link("Account")
        expect(page).to_not have_link("Roles")
        expect(page).to_not have_link("Updates")

        company_worker.update_column(:pay_rate_type, "project_based")
        visit root_path
        expect(page).to have_link("Invoices")
        expect(page).to_not have_link("Expenses")
        expect(page).to_not have_link("Tracking")
        expect(page).to have_link("Documents")
        expect(page).to_not have_link("People")
        expect(page).to have_link("Equity")
        expect(page).to_not have_link("Analytics")
        expect(page).to_not have_link("Roles")

        company_worker.update!(company:)
        visit root_path
        expect(page).to_not have_link("People")

        Flipper.enable(:company_updates, company)
        visit root_path
        click_on "Updates"
        expect(page).to have_current_path(spa_company_updates_company_index_path(company.external_id))
      end
    end
  end

  context "when the user is a company administrator" do
    it "renders the expected navigation links" do
      sign_in company_administrator.user

      visit root_path

      expect(page).to have_link("Invoices")
      expect(page).to have_link("Documents")
      expect(page).to have_link("People")
      expect(page).to have_link("Analytics")
      expect(page).to have_link("Roles")
      expect(page).to_not have_link("Expenses")
      expect(page).to_not have_link("Equity")
      expect(page).to_not have_link("Updates")
      expect(page).to have_link("Account")

      company.update!(equity_enabled: true)
      visit root_path
      click_on "Equity"
      expect(page).to have_current_path(spa_company_cap_table_path(company.external_id))

      Flipper.enable(:company_updates, company)
      visit root_path
      click_on "Updates"
      expect(page).to have_current_path(spa_company_updates_company_index_path(company.external_id))
      Flipper.disable(:company_updates, company)

      visit root_path
      expect(page).to have_link("Documents")
      company.update!(expense_cards_enabled: true)
      visit root_path
      expect(page).to have_link("Expenses")
    end

    context "when the user is also a contractor for a different company" do
      let(:other_company) { create(:company) }

      before do
        create(:company_worker, company: other_company, user: company_administrator.user)
        company_administrator.user.update!(invited_by: create(:company_worker, company:).user)
        sign_in company_administrator.user

        %i[company_updates cap_table].each do |feature|
          Flipper.enable(feature)
        end
      end

      it "renders the navigation for both companies" do
        visit root_path

        select_disclosure company.display_name do
          expect(page).to have_link("Updates", href: spa_company_updates_company_index_path(company.external_id))
          expect(page).to have_link("Invoices", href: spa_company_invoices_path(company.external_id))
          expect(page).to have_link("Documents", href: spa_company_documents_path(company.external_id))
          expect(page).to have_link("People", href: spa_company_workers_path(company.external_id))
          expect(page).to have_link("Roles", href: spa_company_roles_path(company.external_id))
          expect(page).to have_link("Equity", href: spa_company_cap_table_path(company.external_id))
        end

        click_on "Updates"
        expect(page).to have_selector("h1", text: "Updates")

        click_on "Invoices"
        expect(page).to have_selector("h1", text: "Invoicing")

        click_on "Documents"
        expect(page).to have_selector("h1", text: "Documents")

        click_on "People"
        expect(page).to have_selector("h1", text: "People")

        click_on "Roles"
        expect(page).to have_selector("h1", text: "Roles")

        click_on "Analytics"
        expect(page).to have_selector("h1", text: "Analytics")

        click_on "Equity"
        expect(page).to have_selector("h1", text: "Equity")

        select_disclosure other_company.display_name do
          expect(page).to have_link("Invoices", href: spa_company_invoices_path(other_company.external_id))
          expect(page).to have_link("Tracking", href: spa_company_time_tracking_path(other_company.external_id))
          expect(page).to have_link("Documents", href: spa_company_documents_path(other_company.external_id))
        end

        click_on "Invoices"
        expect(page).to have_selector("h1", text: "Invoicing")

        click_on "Tracking"
        expect(page).to have_selector("h1", text: "#{Date.current.strftime('%B')}")

        click_on "Documents"
        expect(page).to have_selector("h1", text: "Documents")
      end
    end
  end

  context "when the user is a company lawyer" do
    it "renders the expected navigation links" do
      sign_in company_lawyer.user

      visit root_path
      wait_for_ajax

      expect(page).to have_current_path(spa_company_documents_path(company.external_id))
      expect(page).to_not have_link("Invoices")
      expect(page).to have_link("Documents")
      expect(page).to_not have_link("People")
      expect(page).to_not have_link("Analytics")
      expect(page).to_not have_link("Roles")

      Flipper.enable(:cap_table, company)
      company.update!(expense_cards_enabled: true)

      visit root_path

      expect(page).to have_link("Equity")
      expect(page).to_not have_link("Updates")
      expect(page).to_not have_link("Expenses")
      expect(page).to have_link("Account")

      click_on "Equity"
      expect(page).to have_current_path(spa_company_cap_table_path(company.external_id))
    end
  end

  context "when the user is a company investor" do
    let(:company_investor) { create(:company_investor, company:) }

    it "renders the expected navigation links" do
      sign_in company_investor.user

      visit root_path

      expect(page).to have_link("Equity")
      expect(page).to have_link("Dividends")
      expect(page).to_not have_link("Cap table")
      expect(page).to_not have_link("Invoices")
      expect(page).to_not have_link("People")
      expect(page).to_not have_link("Analytics")
      expect(page).to_not have_link("Roles")
      expect(page).to_not have_link("Documents")

      expect(page).to have_link("Account")

      Flipper.enable(:cap_table, company)
      visit root_path
      expect(page).to have_link("Dividends")
      expect(page).to have_link("Cap table")

      Flipper.enable(:company_updates, company)
      visit root_path
      expect(page).to have_link("Updates")
      expect(page).to have_link("Analytics")
      Flipper.disable(:company_updates, company)

      visit root_path
      expect(page).to have_link("Documents")

      create(:share_certificate_doc, company:, user: company_investor.user)
      visit root_path
      expect(page).to have_link("Documents")
    end
  end

  describe "Role switcher" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }
    let!(:company_worker) { create(:company_worker, company:, user:) }
    let!(:company_administrator) { create(:company_administrator, company:, user:) }
    let(:another_company) { create(:company) }
    let!(:another_company_lawyer) { create(:company_lawyer, company: another_company, user:) }

    before do
      Flipper.enable(:role_switch)
      sign_in(user)
    end

    it "switches the role" do
      visit root_path
      wait_for_ajax

      select_disclosure company.display_name do
        expect(page).to have_text("Worker")
        expect(page).to have_link("Use as admin", href: root_path)
        expect(page).not_to have_link("Analytics")
      end

      click_on "Use as admin"
      select_disclosure company.display_name do
        expect(page).to have_text("Administrator")
        expect(page).to have_link("Use as worker", href: root_path)
        expect(page).to have_link("Analytics")
      end
    end
  end
end
