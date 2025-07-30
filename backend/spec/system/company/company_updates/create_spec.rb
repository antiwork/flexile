# frozen_string_literal: true

RSpec.describe "Company update create flow" do
  let!(:company_administrator) { create(:company_administrator) }
  let(:user) { company_administrator.user }
  let(:company) { company_administrator.company }
  let!(:company_investor) { create(:company_investor, company:) }

  before do
    Flipper.enable(:company_updates, company)
    travel_to Time.zone.local(2023, 5, 15)
    sign_in user
    create_list(:company_worker, 3, company:)
    create_list(:company_investor, 2, company:)
  end

  context "when creating a new company update" do
    it "allows creation and publishing of a company update" do
      visit new_spa_company_updates_company_path(company.external_id)

      expect(page).to have_button("Publish")

      expect(page).to have_text("New company update")

      expect(page).to have_text("RECIPIENTS (5)")
      expect(page).to have_text("2 investors")
      expect(page).to have_text("3 active contractors")

      expect(page).not_to have_text("Revenue")
      expect(page).to have_text("Update")
      expect(page).to have_text("Video URL (optional)")



      fill_in "Title", with: "April 2023"



      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      fill_in "Video URL (optional)", with: "https://example.com/video"

      click_button "Publish"
      expect(page).to have_text("Your update will be emailed to 5 stakeholders.")

      expect do
        click_button "Yes, publish"
        wait_for_navigation
      end.to change { CompanyUpdate.count }.by(1)
        .and change { CompanyUpdateEmailJob.jobs.size }.by(5)

      expect(current_path).to eq(spa_company_updates_company_index_path(company.external_id))

      company_update = CompanyUpdate.last
      expect(company_update.title).to eq("April 2023")
      expect(company_update.body).to eq("<p>This is our monthly update for April 2023.</p>")
      expect(company_update.video_url).to eq("https://example.com/video")

      expect(page).to have_table(with_rows: [
                                   {
                                     "Sent on" => "May 15, 2023",
                                     "Title" => "April 2023",
                                     "Status" => CompanyUpdate::SENT,
                                   },
                                 ])
    end

    it "validates required fields" do
      visit new_spa_company_updates_company_path(company.external_id)

      click_button "Publish"
      expect(page).to have_field("Title", valid: false)

      fill_in "Title", with: "April 2023"
      expect(page).to have_field("Title", valid: true)
      click_button "Publish"
      expect(page).to have_field("Title", valid: true)
      expect(find_rich_text_editor("Update")["aria-invalid"]).to eq "true"
    end

    it "allows creation without optional fields" do
      visit new_spa_company_updates_company_path(company.external_id)

      fill_in "Title", with: "April 2023"
      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      expect do
        click_button "Publish"
        click_button "Yes, publish"
        wait_for_ajax
      end.to change { CompanyUpdate.count }.by(1)

      company_update = CompanyUpdate.last
      expect(company_update.video_url).to eq(nil)
      expect(company_update.period).to be_nil
    end



    it "allows formatting text using rich text editor buttons" do
      visit new_spa_company_updates_company_path(company.external_id)

      fill_in "Title", with: "another title"

      editor = find_rich_text_editor("Update")
      editor.click

      click_on "Heading"
      editor.send_keys("This is a heading")
      editor.send_keys(:enter)
      expect(editor).to have_selector("h2", text: "This is a heading")

      editor.send_keys(:enter)
      editor.send_keys("This is a ")
      click_on "Link"

      within("dialog") do
        fill_in "URL", with: "https://example.com"
        click_button "Insert"
      end

      editor.send_keys("link")
      expect(editor).to have_selector("a[href='https://example.com']", text: "link")

      editor.send_keys(:enter)
      click_on "Bold"
      editor.send_keys("This is bold text")
      expect(editor).to have_selector("strong", text: "This is bold text")

      editor.send_keys(:enter)
      click_on "Bullet list"
      editor.send_keys("First item")
      editor.send_keys(:enter)
      editor.send_keys("Second item")
      expect(editor).to have_selector("ul li", text: "First item")
      expect(editor).to have_selector("ul li", text: "Second item")

      click_button "Publish"
      click_button "Yes, publish"
      wait_for_ajax

      company_update = CompanyUpdate.last
      expect(company_update.body).to match(/<h2>This is a heading<\/h2>/)
      expect(company_update.body).to match(/<ul[^>]*>.*<li[^>]*>.*First item.*<\/li>.*<li[^>]*>.*Second item.*<\/li>.*<\/ul>/m)
      expect(company_update.body).to match(/<a[^>]*href="https:\/\/example\.com"[^>]*>link<\/a>/)
      expect(company_update.body).to match(/<strong>This is bold text<\/strong>/)
    end
  end

  context "when previewing the update" do
    it "shows the preview on a new tab" do
      visit new_spa_company_updates_company_path(company.external_id)


      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      click_button "Preview"
      expect(page).to have_text("April 2023")
      expect(page).to have_text("This is our monthly update for April 2023.")
    end

    it "replaces the /new page with the /edit page" do
      visit new_spa_company_updates_company_path(company.external_id)

      fill_in "Title", with: "another title"

      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      initial_tab = current_window
      preview_tab = window_opened_by { click_button "Preview" }
      preview_tab.close
      switch_to_window initial_tab
      wait_for_ajax

      expect(page).not_to have_current_path(new_spa_company_updates_company_path(company.external_id))

      last_update = CompanyUpdate.last
      expect(page).to have_current_path(edit_spa_company_updates_company_path(company.external_id, last_update.external_id))
    end

    it "saves the company update as a draft when previewing and doesn't trigger emails" do
      visit new_spa_company_updates_company_path(company.external_id)

      fill_in "Title", with: "another title"

      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      expect do
        initial_tab = current_window
        preview_tab = window_opened_by { click_button "Preview" }
        preview_tab.close
        switch_to_window initial_tab
        wait_for_ajax
      end.to change { CompanyUpdate.count }.by(1)
        .and not_change { CompanyUpdateEmailJob.jobs.size }

      company_update = CompanyUpdate.last
      expect(company_update.status).to eq(CompanyUpdate::DRAFT)
      expect(company_update.title).to eq("another title")
      expect(company_update.body).to eq("<p>This is our monthly update for April 2023.</p>")
    end

    it "shows errors for missing required fields when attempting to preview" do
      visit new_spa_company_updates_company_path(company.external_id)

      click_button "Preview"

      expect(page).to have_field("Title", valid: false)
      expect(find_rich_text_editor("Update")["aria-invalid"]).to eq "true"
    end

    it "doesn't show the styling header" do
      visit new_spa_company_updates_company_path(company.external_id)

      fill_in "Title", with: "another title"

      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      preview_window = window_opened_by { click_button "Preview" }
      switch_to_window(preview_window)
      expect(page).to have_text("Previewing:")

      expect(page).to_not have_button("Bold")
      expect(page).to_not have_button("Bullet list")
      expect(page).to_not have_button("Link")
      expect(page).to_not have_button("Heading")
    end
  end
end
