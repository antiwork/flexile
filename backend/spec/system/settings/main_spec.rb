# frozen_string_literal: true

RSpec.describe "User settings" do
  include ActionView::Helpers::NumberHelper

  describe "Personal details section" do
    before { sign_in user }

    shared_examples "doesn't render preferred name field" do
      it "doesn't render preferred name field" do
        visit spa_settings_path

        within_section "Personal details", section_element: :form do
          expect(page).to have_field("Email", with: user.email, disabled: true)
          expect(page).not_to have_field("Preferred name (visible to others)")

          expect(page).to have_button("Save changes", disabled: true)
        end
      end
    end

    shared_examples "allows updating preferred name" do
      it "allows updating preferred name" do
        visit spa_settings_path

        within_section "Personal details", section_element: :form do
          expect(page).to have_field("Email", with: user.email, disabled: true)
          expect(page).to have_field("Preferred name (visible to others)", with: user.preferred_name)

          fill_in "Preferred name (visible to others)", with: "Jane"
          click_on "Save changes"
          wait_for_ajax
        end

        expect(user.reload.preferred_name).to eq "Jane"
      end
    end

    context "when the user doesn't have a role" do
      let(:user) do
        user = create(
          :user,
          :without_legal_details,
          without_bank_account: true,
          without_compliance_info: true
        )
        user.update!(preferred_name: nil)
        user
      end

      it_behaves_like "doesn't render preferred name field"
    end

    context "when the user is a contractor" do
      let(:company_worker) { create(:company_worker) }
      let(:user) { company_worker.user }

      it_behaves_like "allows updating preferred name"
    end

    context "when the user is a lawyer" do
      let(:company_lawyer) { create(:company_lawyer) }
      let(:user) { company_lawyer.user }

      before { create(:company_lawyer, user:) }

      it_behaves_like "allows updating preferred name"
    end

    context "when the user is an administrator" do
      let(:company_administrator) { create(:company_administrator) }
      let(:user) { company_administrator.user }

      before { create(:company_administrator, user:) }

      it_behaves_like "allows updating preferred name"
    end

    let(:params) { { user: { preferred_name: "007" } } }

    context "when the user is an investor" do
      let(:company_investor) { create(:company_investor) }
      let(:user) { company_investor.user }

      it_behaves_like "doesn't render preferred name field"
    end
  end
end
