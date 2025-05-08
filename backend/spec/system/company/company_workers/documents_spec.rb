# frozen_string_literal: true

RSpec.describe "Documents listing page" do
  let(:contractor_user) { contractor.user }
  let(:company) { create(:company) }
  let(:admin_user) { create(:company_administrator, company:).user }
  let(:contractor) { create(:company_worker, company:) }
  let!(:form_w8ben) do
    deleted_user_compliance_info = create(:user_compliance_info, :non_us_resident, user: contractor_user, deleted_at: Time.current)
    create(:tax_doc, :deleted, :form_w8ben, company:, user: contractor_user, user_compliance_info: deleted_user_compliance_info)
  end
  let(:user_compliance_info) { create(:user_compliance_info, :us_resident, user: contractor_user) }
  let!(:form_w9) do
    create(:tax_doc, :form_w9, company:, user: contractor_user, user_compliance_info:, created_at: Date.parse("15 Jan 2023"))
  end
  let!(:form_1099nec) do
    create(:tax_doc, :submitted, :form_1099nec, company:, user_compliance_info:, user: contractor_user,
                                                created_at: Date.parse("15 Jan 2023"),
                                                completed_at: Date.parse("31 Jan 2023"))
  end

  before do
    # Documents for another contractor
    contractor_2 = create(:company_worker, company:)
    user_compliance_info_2 = create(:user_compliance_info, :us_resident, user: contractor_2.user)
    @other_w9 = create(:tax_doc, :form_w9, company:, user_compliance_info: user_compliance_info_2, user: contractor_2.user,
                                           created_at: Date.parse("31 Jan 2023"))
    @other_1099nec = create(:tax_doc, :form_1099nec, company:, user: contractor_2.user,
                                                     user_compliance_info: user_compliance_info_2,
                                                     created_at: Date.parse("15 Jan 2023"),
                                                     completed_at: Date.parse("31 Jan 2023"))
    sign_in admin_user
  end

  it "shows documents formatted as expected" do
    visit spa_company_worker_path(company.external_id, contractor.external_id, selectedTab: "documents")

    expect(page).to have_selector("h1", text: contractor_user.name)
    expect(page).to have_button("End contract")

    within(:table_row, { "Document" => form_w9.name, "Date" => "Jan 15, 2023", "Status" => "Signed" }) do
      expect(page).to have_link(href: rails_blob_path(form_w9.attachment, disposition: "attachment"))
    end

    within(:table_row, { "Document" => form_1099nec.name, "Date" => "Jan 15, 2023", "Status" => "Filed on Jan 31, 2023" }) do
      expect(page).to have_link(href: rails_blob_path(form_1099nec.attachment, disposition: "attachment"))
    end
  end
end
