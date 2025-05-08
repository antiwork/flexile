# frozen_string_literal: true

RSpec.describe "Company updates page" do
  let(:company) { create(:company) }

  before { Flipper.enable(:company_updates, company) }

  context "when authenticated as a company administrator" do
    let(:company_admin) { create(:company_administrator, company:).user }

    before { sign_in company_admin }

    context "when updates exist" do
      let!(:update1) { create(:company_update, company:, title: "2023 update", sent_at: Time.zone.parse("2024-01-24")) }
      let!(:update2) { create(:company_update, company:, title: "Q1 2024 update") }
      let!(:update3) { create(:company_update, company:, title: "January 2024 update") }

      it "shows a table with the updates and relevant information about them, and a button to create a new one" do
        visit spa_company_updates_company_index_path(company.external_id)

        expect(page).to have_text("Updates")

        expect(page).to have_table(with_rows: [
                                     {
                                       "Sent on" => "-",
                                       "Title" => "January 2024 update",
                                       "Status" => CompanyUpdate::DRAFT,
                                     },
                                     {
                                       "Sent on" => "-",
                                       "Title" => "Q1 2024 update",
                                       "Status" => CompanyUpdate::DRAFT,
                                     },
                                     {
                                       "Sent on" => "Jan 24, 2024",
                                       "Title" => "2023 update",
                                       "Status" => CompanyUpdate::SENT,
                                     },
                                   ])

        expect(page).to have_link("New update", href: new_spa_company_updates_company_path(company.external_id))
      end

      context "pagination" do
        it "paginates records" do
          stub_const("CompanyUpdatesPresenter::RECORDS_PER_PAGE", 1)

          visit spa_company_updates_company_index_path(company.external_id)

          expect(page).to have_text("Showing 1-1 of 3")
          expect(page).to have_table(with_rows: [
                                       {
                                         "Sent on" => "-",
                                         "Title" => "January 2024 update",
                                         "Status" => CompanyUpdate::DRAFT,
                                       }
                                     ])

          within "[aria-label='Pagination']" do
            click_on "2"
          end

          expect(page).to have_text("Showing 2-2 of 3")
          expect(page).to have_table(with_rows: [
                                       {
                                         "Sent on" => "-",
                                         "Title" => "Q1 2024 update",
                                         "Status" => CompanyUpdate::DRAFT,
                                       }
                                     ])
        end

        it "doesn't show the pagination element if there is only one page" do
          visit spa_company_updates_company_index_path(company.external_id)

          expect(page).to have_selector("[aria-label='Pagination']", count: 0)
        end
      end
    end

    context "when there are no updates" do
      it "shows a message and a button to create a new update" do
        visit spa_company_updates_company_index_path(company.external_id)

        expect(page).to have_text("No updates to display.")
        expect(page).to have_link("New update", href: new_spa_company_updates_company_path(company.external_id))
      end
    end

    it "can delete a company update" do
      create(:company_update, company:, title: "Q1 2024 update")
      create(:company_update, company:, title: "January 2024 update")

      visit spa_company_updates_company_index_path(company.external_id)

      within(:table_row, { "Title" => "Q1 2024 update" }) do
        click_on "Remove"
      end

      within_modal do
        expect(page).to have_text("Delete update?")
        expect(page).to have_text('"Q1 2024 update" will be permanently deleted and cannot be restored.')
        expect(page).to have_button("No, cancel")
        expect(page).to have_button("Yes, delete")

        click_button "Yes, delete"
      end

      expect(page).to have_no_text("Q1 2024 update")
      expect(page).to have_table(with_rows: [
                                   {
                                     "Sent on" => "-",
                                     "Title" => "January 2024 update",
                                     "Status" => CompanyUpdate::DRAFT,
                                   }
                                 ])
      expect(CompanyUpdate.find_by(title: "Q1 2024 update")).to be_nil
    end
  end

  context "when authenticated as a company worker" do
    let(:company_worker) { create(:company_worker, company:).user }

    before { sign_in company_worker }

    context "when updates exist" do
      let!(:update1) { create(:company_update, company:, sent_at: Time.current, title: "2023") }
      let!(:update2) { create(:company_update, company:, sent_at: Time.current, title: "Q1 2024", body: "<p>This is the body of the update.</p>") }
      let!(:update3) { create(:company_update, company:, title: "January 2024 update") }

      it "shows a list of updates" do
        visit spa_company_updates_company_index_path(company.external_id)

        expect(page).to have_text("Updates")

        expect(page).to have_link("2023", href: spa_company_updates_company_path(company.external_id, update1.external_id))
        expect(page).to have_link("Q1 2024", href: spa_company_updates_company_path(company.external_id, update2.external_id))
        within(find(:link, "Q1 2024")) do
          expect(page).to have_text("This is the body of the update.")
        end
        expect(page).not_to have_link("January 2024")
      end
    end

    context "when there are no updates" do
      it "shows a message" do
        visit spa_company_updates_company_index_path(company.external_id)

        expect(page).to have_text("No updates to display.")
      end
    end
  end
end
