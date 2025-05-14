# frozen_string_literal: true

RSpec.describe "Option pools" do
  let(:company) { create(:company, equity_grants_enabled: true) }

  shared_examples "a user with access" do
    before do
      sign_in user
    end

    context "when option pools exist" do
      before do
        create(:option_pool, name: "2020 Equity Plan",
                             authorized_shares: 1_234_567,
                             issued_shares: 93_345,
                             company:)
        create(:option_pool, name: "Bonus Pool",
                             authorized_shares: 890_123,
                             issued_shares: 29_892,
                             company:)
      end

      it "lists them" do
        visit spa_company_option_pools_path(company.external_id)

        # Tab heading
        expect(page).to have_text("Option pools")
        expect(page).to have_link("Options", href: spa_company_equity_path(company.external_id))

        # Table
        expect(page).to have_selector(:table_row, {
          "Name" => "2020 Equity Plan",
          "Authorized shares" => "1,234,567",
          "Available shares" => "1,141,222", # 1,234,567 - 93,345
          "Issued shares" => "93,345",
        })
        expect(page).to have_selector(:table_row, {
          "Name" => "Bonus Pool",
          "Authorized shares" => "890,123",
          "Available shares" => "860,231", # 890,123 - 29,892
          "Issued shares" => "29,892",
        })
      end
    end

    it "shows a message when there are no option pools" do
      visit spa_company_option_pools_path(company.external_id)

      expect(page).to have_text("The company does not have any option pools.")
    end
  end

  context "when authenticated as a company administrator" do
    let(:user) { create(:company_administrator, company:).user }

    it_behaves_like "a user with access"
  end

  context "when authenticated as a company lawyer" do
    let(:user) { create(:company_lawyer, company:).user }

    it_behaves_like "a user with access"
  end
end
