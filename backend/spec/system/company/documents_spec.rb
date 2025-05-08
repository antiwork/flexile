# frozen_string_literal: true

RSpec.describe "Documents page" do
  let(:company) { create(:company) }
  let(:company_administrator) { create(:company_administrator, company:) }
  let(:user_1) { create(:user) }
  let!(:company_worker_1) { create(:company_worker, user: user_1, company:, without_contract: true) }
  let(:company_worker_2) { create(:company_worker, company:, without_contract: true) }
  let(:company_investor_1) { create(:company_investor, company:, user: user_1) }
  let!(:document_1) do
    create(:document, :signed, company:, company_administrator:, company_worker: company_worker_1, user: user_1, created_at: 14.days.ago)
  end
  let!(:document_2) do
    create(:document, :signed, company:, company_administrator:, company_worker: company_worker_2, user: company_worker_2.user, created_at: 13.days.ago)
  end
  let!(:equity_document_1) do
    create(:equity_plan_contract_doc, company:, company_administrator:, company_worker: company_worker_1, user: user_1, created_at: 12.days.ago)
  end
  let!(:equity_document_2) do
    create(:equity_plan_contract_doc, :signed, company:, company_administrator:, company_worker: company_worker_2, user: company_worker_2.user, created_at: 11.days.ago)
  end
  let!(:share_certificate) do
    create(:share_certificate_doc, company:, user: user_1, created_at: 10.days.ago)
  end
  let!(:exercise_notice) do
    create(:exercise_notice, company:, company_administrator:, company_worker: company_worker_1, user: user_1, created_at: 9.days.ago)
  end

  context "when signed in as a company administrator" do
    let(:company_worker) { create(:company_worker, company:, without_contract: true) }
    let(:company_investor) { create(:company_investor, company:) }
    let(:company_investor_and_contractor) do
      create(:company_investor, company:)
      create(:company_worker, company:, without_contract: true)
    end
    let(:us_user_compliance_info_1) { create(:user_compliance_info, :us_resident, user: company_worker.user) }
    let(:us_user_compliance_info_2) { create(:user_compliance_info, :us_resident, user: company_investor_and_contractor.user) }
    let(:non_us_user_compliance_info) { create(:user_compliance_info, :non_us_resident, user: company_investor.user) }
    let!(:form_w9_1) do
      build(:tax_doc, :form_w9, company:, user: us_user_compliance_info_1.user, user_compliance_info: us_user_compliance_info_1, created_at: 1.day.ago)
    end
    let!(:form_w9_2) do
      create(:tax_doc, :form_w9, company:, user: us_user_compliance_info_2.user, user_compliance_info: us_user_compliance_info_2, created_at: 1.day.ago)
    end
    let!(:form_w8ben) do
      create(:tax_doc, :form_w8ben, company:, user: non_us_user_compliance_info.user, user_compliance_info: non_us_user_compliance_info, created_at: 1.day.ago)
    end
    let!(:form_1042s) do
      create(:tax_doc, :submitted, :form_1042s, company:, user: non_us_user_compliance_info.user, user_compliance_info: non_us_user_compliance_info)
    end
    let!(:unsubmitted_form_1099nec) do
      build(:tax_doc, :form_1099nec, company:, user: us_user_compliance_info_1.user, user_compliance_info: us_user_compliance_info_1)
    end
    let!(:submitted_form_1099nec) do
      create(:tax_doc, :form_1099nec, :submitted, company:, user: us_user_compliance_info_2.user, user_compliance_info: us_user_compliance_info_2, created_at: 1.hour.ago)
    end
    let!(:past_year_submitted_form_1099nec) do
      create(:tax_doc, :form_1099nec, :submitted,
             company:,
             user: us_user_compliance_info_1.user,
             user_compliance_info: us_user_compliance_info_1,
             year: Date.current.year - 1,
             created_at: 1.year.ago,
             completed_at: 1.year.ago)
    end
    let!(:submitted_form_1099div) do
      create(:tax_doc, :form_1099div, :submitted, company:, user: us_user_compliance_info_2.user, user_compliance_info: us_user_compliance_info_2)
    end

    before do
      old_user_compliance_info = create(:user_compliance_info, :us_resident,
                                        user: company_worker.user,
                                        created_at: 2.days.ago, deleted_at: 1.day.ago)
      create(:tax_doc, :form_w9, :deleted, user: old_user_compliance_info.user, user_compliance_info: old_user_compliance_info, company:)
      create(:tax_doc, :form_1099nec, :deleted, user: old_user_compliance_info.user, user_compliance_info: old_user_compliance_info, company:)

      create(:tax_doc, :form_w9, :deleted, user: us_user_compliance_info_1.user, user_compliance_info: us_user_compliance_info_1, company:)
      create(:tax_doc, :form_1099nec, :deleted, user: us_user_compliance_info_1.user, user_compliance_info: us_user_compliance_info_1, company:)

      unsubmitted_form_1099nec.save! # to bypass the uniqueness validation error
      form_w9_1.save! # to bypass the uniqueness validation error

      sign_in company_administrator.user
    end

    it "shows all documents except unsigned agreements" do
      visit spa_company_documents_path(company.external_id)

      expect(page).to have_selector("h1", text: "Documents")
      expect(page).to have_select("Filter by year", selected: Date.current.year.to_s)
      expect(page).to_not have_link("New document")

      within(:table_row, {
        "User" => user_1.name,
        "Document" => exercise_notice.name,
        "Type" => "Exercise notice",
        "Date" => "#{exercise_notice.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Issued",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(exercise_notice.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => user_1.name,
        "Document" => share_certificate.name,
        "Type" => "Certificate",
        "Date" => "#{share_certificate.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Issued",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(share_certificate.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_worker_2.user.name,
        "Document" => equity_document_2.name,
        "Type" => "Agreement",
        "Date" => "#{equity_document_2.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(equity_document_2.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_worker_2.user.name,
        "Document" => document_2.name,
        "Type" => "Agreement",
        "Date" => "#{document_2.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(document_2.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_worker_1.user.name,
        "Document" => document_1.name,
        "Type" => "Agreement",
        "Date" => "#{document_1.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(document_1.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_worker.user.name,
        "Document" => "1099-NEC",
        "Type" => "Tax form",
        "Date" => "#{unsubmitted_form_1099nec.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Ready for filing",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(unsubmitted_form_1099nec.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_investor_and_contractor.user.name,
        "Document" => "1099-NEC",
        "Type" => "Tax form",
        "Date" => "#{submitted_form_1099nec.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Filed on #{submitted_form_1099nec.completed_at.strftime("%b %-d, %Y")}",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(submitted_form_1099nec.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_investor_and_contractor.user.name,
        "Document" => "1099-DIV",
        "Type" => "Tax form",
        "Date" => "#{submitted_form_1099div.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Filed on #{submitted_form_1099div.completed_at.strftime("%b %-d, %Y")}",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(submitted_form_1099div.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_worker.user.name,
        "Document" => "W-9",
        "Type" => "Tax form",
        "Date" => "#{form_w9_1.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_w9_1.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_investor_and_contractor.user.name,
        "Document" => "W-9",
        "Type" => "Tax form",
        "Date" => "#{form_w9_2.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_w9_2.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_investor.user.name,
        "Document" => "W-8BEN",
        "Type" => "Tax form",
        "Date" => "#{form_w8ben.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_w8ben.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "User" => company_investor.user.name,
        "Document" => "1042-S",
        "Type" => "Tax form",
        "Date" => "#{form_1042s.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Filed on #{form_1042s.completed_at.strftime("%b %-d, %Y")}",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_1042s.attachment, disposition: "attachment"))
      end

      expect(page).to_not have_selector("[aria-label='Pagination']")

      stub_const("DocumentsPresenter::RECORDS_PER_PAGE", 1)
      visit spa_company_documents_path(company.external_id)

      expect(page).to have_table(with_rows: [{
        "User" => company_worker.user.name,
        "Document" => "1099-NEC",
        "Status" => "Ready for filing",
      }])
      expect(page).to have_text("Showing 1-1 of 12")

      within "[aria-label='Pagination']" do
        click_on "2"
      end

      expect(page).to have_table(with_rows: [{
        "User" => company_investor_and_contractor.user.name,
        "Document" => "1099-DIV",
        "Status" => "Filed on #{submitted_form_1099div.completed_at.strftime("%b %-d, %Y")}",
      }])
      expect(page).to have_text("Showing 2-2 of 12")

      select past_year_submitted_form_1099nec.year, from: "Filter by year"

      expect(page).to have_table(with_rows: [
                                   {
                                     "User" => company_worker.user.name,
                                     "Document" => "1099-NEC",
                                     "Status" => "Filed on #{past_year_submitted_form_1099nec.completed_at.strftime("%b %-d, %Y")}",
                                   },
                                 ])
      expect(page).to_not have_selector("[aria-label='Pagination']")
    end

    it "asserts the upcoming filing footer" do
      is_before_filing_due_date = Date.current <= Date.new(Date.current.year, 3, 31)

      visit spa_company_documents_path(company.external_id)

      expect(page).to have_selector("h1", text: "Documents")

      if is_before_filing_due_date
        expect(page).to have_selector("h2", text: "Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S")
      else
        expect(page).to_not have_selector("h2", text: "Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S")
      end

      visit spa_company_documents_path(company.external_id, year: Date.current.year - 1)

      expect(page).to have_selector("h1", text: "Documents")
      expect(page).to_not have_selector("h2", text: "Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S")
    end

    context "when lawyers are enabled" do
      before do
        company.update!(lawyers_enabled: true)
      end

      it "allows inviting a lawyer" do
        visit spa_company_documents_path(company.external_id)

        expect(page).to have_button("Invite lawyer")

        click_button "Invite lawyer"
        expect(page).to have_content("Who's joining?")

        fill_in "Email", with: "new_lawyer@example.com"
        click_button "Invite"

        wait_for_ajax

        expect(CompanyLawyer.count).to eq(1)
        expect(CompanyLawyer.last.user.email).to eq("new_lawyer@example.com")
      end

      it "shows an error when inviting an existing user" do
        visit spa_company_documents_path(company.external_id)

        existing_user = create(:user, email: "existing_lawyer@example.com")

        click_button "Invite lawyer"
        fill_in "Email", with: existing_user.email
        click_button "Invite"

        expect(page).to have_content("Email has already been taken")
        expect(CompanyLawyer.count).to eq(0)
      end
    end

    context "when lawyers are disabled" do
      before do
        company.update!(lawyers_enabled: false)
      end

      it "does not show the invite lawyer button" do
        visit spa_company_documents_path(company.external_id)

        expect(page).to_not have_button("Invite lawyer")
      end
    end
  end

  context "when signed in as an investor or contractor" do
    let(:user_compliance_info) { create(:user_compliance_info, :us_resident, user: user_1) }
    let!(:form_w9) { create(:tax_doc, :form_w9, company:, user: user_1, user_compliance_info:, created_at: 1.day.ago) }
    let!(:form_1099nec) { create(:tax_doc, :submitted, :form_1099nec, company:, user: user_1, user_compliance_info:) }
    let!(:form_1099div) { create(:tax_doc, :form_1099div, company:, user: user_1, user_compliance_info:) }

    before { sign_in user_1 }

    it "shows the documents page" do
      visit spa_company_documents_path(company.external_id)

      expect(page).to have_selector("h1", text: "Documents")
      expect(page).to have_select("Filter by year", selected: Date.current.year.to_s)
      within(:table_row, {
        "Document" => "1099-DIV",
        "Type" => "Tax form",
        "Date" => "#{form_1099div.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Ready for filing",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_1099div.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "Document" => "1099-NEC",
        "Type" => "Tax form",
        "Date" => "#{form_1099nec.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Filed on #{form_1099nec.completed_at.to_date.to_fs(:medium)}",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_1099nec.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "Document" => "W-9",
        "Type" => "Tax form",
        "Date" => "#{form_w9.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(form_w9.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "Document" => exercise_notice.name,
        "Type" => "Exercise notice",
        "Date" => "#{exercise_notice.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Issued",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(exercise_notice.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "Document" => share_certificate.name,
        "Type" => "Certificate",
        "Date" => "#{share_certificate.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Issued",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(share_certificate.attachment, disposition: "attachment"))
      end
      within(:table_row, {
        "Document" => equity_document_1.name,
        "Type" => "Agreement",
        "Date" => "#{equity_document_1.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signature required",
      }) do
        expect(page).to have_link("Review & sign", href: spa_company_stock_options_contract_path(company.external_id, equity_document_1.id))
      end
      within(:table_row, {
        "Document" => document_1.name,
        "Type" => "Agreement",
        "Date" => "#{document_1.created_at.strftime("%b %-d, %Y")}",
        "Status" => "Signed",
      }) do
        expect(page).to have_link("Download", href: rails_blob_path(document_1.attachment, disposition: "attachment"))
      end

      # Pagination
      expect(page).to_not have_selector("[aria-label='Pagination']")

      stub_const("DocumentsPresenter::RECORDS_PER_PAGE", 1)
      visit spa_company_documents_path(company.external_id)

      expect(page).to have_table(with_rows: [{
        "Document" => "1099-DIV",
        "Type" => "Tax form",
        "Date" => "#{form_1099div.created_at.strftime("%b %-d, %Y")}",
      }])
      expect(page).to have_text("Showing 1-1 of 7")

      within "[aria-label='Pagination']" do
        click_on "2"
      end

      expect(page).to have_table(with_rows: [{
        "Document" => "1099-NEC",
        "Type" => "Tax form",
        "Date" => "#{form_1099nec.created_at.strftime("%b %-d, %Y")}",
      }])
      expect(page).to have_text("Showing 2-2 of 7")
    end

    context "when contractor has an unsigned consulting contract" do
      before do
        document_1.update_columns(completed_at: nil) # bypass model validations
      end

      it "redirects to the onboarding contract step" do
        visit spa_company_documents_path(company.external_id)

        expect(page).to have_current_path(spa_company_worker_onboarding_contract_path(company.external_id))
      end
    end
  end
end
