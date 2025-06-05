# frozen_string_literal: true

RSpec.describe "Tax Settings" do
  let(:company) { create(:company, :completed_onboarding) }
  let(:user) do
    user = create(:user, :without_compliance_info, legal_name: "Caro Example", preferred_name: "Caro",
                                                   email: "caro@example.com", birth_date: Date.new(1980, 6, 27))
    create(:user_compliance_info, user:, tax_id: "123-45-6789")
    user
  end

  before { sign_in user }

  context "as a contractor" do
    let!(:company_worker) { create(:company_worker, company:, user:) }

    before do
      company_administrator = create(:company_administrator, company:)
      user.update!(invited_by_id: company_administrator.user_id)
    end

    context "when contractor is synced with QuickBooks", :vcr, :sidekiq_inline, :freeze_time do
      let!(:integration) { create(:quickbooks_integration, :active, company:) }
      let!(:integration_record) do
        create(:integration_record, integratable: company_worker, integration:, integration_external_id: "85")
      end

      before do
        user.compliance_info.update!(
          tax_id: "123-45-1212",
          tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED,
          country_code: "US",
          citizenship_country_code: "US",
          street_address: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip_code: "94105",
          tax_information_confirmed_at: Time.current,
        )
      end

      it "creates a new QuickBooks Vendor upon changing the legal entity type and signing the consulting contract" do
        visit spa_settings_tax_path
        wait_for_ajax
        choose "Business"
        fill_in "Tax ID (EIN)", with: "123456789"
        fill_in "Business legal name", with: "Caroline's Boutique, LLC"
        click_on "Save changes"
        expect do
          within_modal do
            expect(page).to have_text("W-9 Certification")
            expect(page).to have_field("Signature", with: "Caro Example")
            click_on "Save"
          end
          wait_for_ajax
          expect(page).to have_current_path(spa_company_worker_onboarding_contract_path(company.external_id))

          click_on "Discovery Procedures (Exhibit B)"
          click_on "Click to add signature"
          click_on "Sign and submit"

          expect(page).to have_selector("h1", text: "Invoicing")
        end.to change { user.reload.user_compliance_infos.count }.from(1).to(2)
            .and change { company_worker.reload.integration_records.count }.from(1).to(2)
            .and change { company_worker.quickbooks_integration_record.integration_external_id }.from("85").to("138")
            .and change { integration_record.reload.deleted_at }.from(nil).to(Time.current)
            .and change { user.business_entity }.from(false).to(true)
      end
    end
  end
end
