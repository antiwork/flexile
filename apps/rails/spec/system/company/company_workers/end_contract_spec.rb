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

    it "allows ending a trialer's contract", :freeze_time do
      company_worker.update!(on_trial: true)
      visit spa_company_worker_path(company.external_id, company_worker.external_id)

      click_on "End trial"

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

    it "allows passing a work trial" do
      company_worker.update!(on_trial: true)
      visit spa_company_worker_path(company.external_id, company_worker.external_id)

      expect(page).to have_button("End trial")

      click_on "Complete trial"

      within "dialog" do
        expect(page).to have_text("Hire #{contractor.name}?")
        expect(page).to have_text("You're hiring #{contractor.name} as a #{company_role.name} for $#{company_role.pay_rate_usd} / hour. Do you want to proceed?")

        expect(page).to have_button("No, cancel")
        expect(page).to have_button("Yes, hire")
      end

      old_pay_rate_usd = company_worker.pay_rate_usd
      expect do
        click_on "Yes, hire"
        wait_for_ajax
        expect(page).to_not have_text("Hire #{contractor.name}?")
      end.to change { company_worker.reload.on_trial }.from(true).to(false)
         .and have_enqueued_mail(CompanyWorkerMailer, :trial_passed).with(company_worker_id: company_worker.id,
                                                                          old_pay_rate_usd:,
                                                                          new_pay_rate_usd: company_role.pay_rate_usd)

      select_tab "Onboarding"
      expect(page).to_not have_text(contractor.name)

      select_tab "Active"
      expect(page).to have_text(contractor.name)

      click_on contractor.name, match: :first
      expect(page).to have_button("End contract")
      expect(page).to have_field("Rate", with: company_role.pay_rate_usd)
      expect(page).to have_field("Average hours", with: 20)
      expect(page).to_not have_button("End trial")
      expect(page).to_not have_button("Complete trial")
    end
  end
end
