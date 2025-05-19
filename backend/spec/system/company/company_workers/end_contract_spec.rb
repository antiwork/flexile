# frozen_string_literal: true

RSpec.describe "End Contract" do
  let(:admin_user) { create(:user, :company_admin) }
  let(:company) { admin_user.company_administrators.first!.company }
  let(:company_role) { create(:company_role, company:) }
  let(:company_worker) { create(:company_worker, company:, company_role:) }
  let(:contractor) { company_worker.user }

  context "when signed in as a company administrator" do
    before do
      sign_in admin_user
      visit spa_company_worker_path(company.external_id, company_worker.external_id)
      expect(page).to have_text(contractor.name)
    end

    it "allows ending a contract", :freeze_time do
      visit spa_company_worker_path(company.external_id, company_worker.external_id)

      click_on "End contract"

      expect(page).to have_text("End contract with #{contractor.name}?")
      expect do
        click_on "Yes, end contract"
        wait_for_ajax
      end.to change { company_worker.reload.ended_at }.from(nil).to(Time.current)

      select_tab "Alumni"
      expect(page).to have_text(contractor.name)

      click_on contractor.name, match: :first
      expect(page).to have_text("Contract ended on #{Time.current.strftime("%b %-d, %Y")}.")
      expect(page).to have_text("Alumni")
      expect(page).to_not have_button("End contract")
      expect(page).to_not have_button("Save changes")
    end
  end
end
