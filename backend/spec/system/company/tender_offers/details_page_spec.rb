# frozen_string_literal: true

RSpec.describe "Tender offer details page" do
  let(:company) { create(:company, tender_offers_enabled: true) }
  let!(:company_administrator) { create(:company_administrator, company:) }
  let(:company_investor_1) { create(:company_investor, company:) }
  let(:company_investor_2) { create(:company_investor, company:) }
  let(:starts_at) { Time.current.beginning_of_day }
  let(:ends_at) { starts_at + 3.weeks }
  let(:tender_offer) { create(:tender_offer, starts_at:, ends_at:, company:, minimum_valuation: 100_000_000) }
  let(:share_class) { create(:share_class, company:) }

  before do
    create(:share_holding, share_class: share_class, company_investor: company_investor_1, number_of_shares: 500)
    create(:equity_grant, company_investor: company_investor_1, number_of_shares: 5_000, vested_shares: 5_000)
    create(:share_holding, share_class: share_class, company_investor: company_investor_2, number_of_shares: 400)
    create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                              number_of_shares: 100, share_price_cents: 20_12, share_class: share_class.name)
    create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                              number_of_shares: 50, share_price_cents: 22_33, share_class: share_class.name)
  end

  context "when logged in as a company investor" do
    before do
      sign_in company_investor_1.user
    end

    it "shows the expected details" do
      visit spa_company_tender_offer_path(company.external_id, tender_offer.external_id)

      # Header
      expect(page).to have_text('Tender offer details ("Sell Elections")')

      # Details
      expect(page).to have_text("#{starts_at.strftime("%b %-d, %Y")} Start date", normalize_ws: true)
      expect(page).to have_text("#{ends_at.strftime("%b %-d, %Y")} End date", normalize_ws: true)
      expect(page).to have_text("$100,000,000 Starting bid valuation", normalize_ws: true)

      # Bids
      expect(page).to have_table(with_rows: [
                                   {
                                     "Investor" => "You!",
                                     "Share class" => share_class.name,
                                     "Number of shares" => "100",
                                     "Bid price" => "$20.12",
                                   },
                                 ])

      expect(page).not_to have_text(
        "Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV " \
        "itself. Please contact them for more information about this process."
      )

      expect(page).to have_text('Submit a bid ("Sell Order")')
      expect(page).to have_select("Share class", with_options: [
                                    "#{share_class.name} (500 shares)",
                                    "Vested shares from equity grants (5,000 shares)",
                                  ])

      expect(find_button("Submit bid", disabled: true)).to have_tooltip "Please sign the letter of transmittal before submitting a bid"
      click_button "Add your signature"
      click_on "Submit bid"
      expect(page).to have_selector("select:invalid")
      expect(page).to have_text("Please select a share class")
      select "Vested shares from equity grants (5,000 shares)", from: "Share class"
      click_on "Submit bid"
      expect(page).to have_field("Number of shares", valid: false)
      expect(page).to have_text("Number of shares must be between 1 and 5,000")
      fill_in "Number of shares", with: "6000"
      click_on "Submit bid"
      expect(page).to have_field("Number of shares", valid: false)
      expect(page).to have_text("Number of shares must be between 1 and 5,000")
      fill_in "Number of shares", with: "3000"
      fill_in "Price per share", with: "0"
      click_on "Submit bid"
      expect(page).to have_field("Price per share", valid: false)
      expect(page).to have_text("Price per share must be greater than 0")
      fill_in "Price per share", with: "24.27"
      click_on "Submit bid"
      wait_for_ajax
      expect(page).not_to have_selector(":invalid")

      # Assert that the defaults are set on the form
      expect(page).to have_field("Share class", with: "")
      expect(page).to have_field("Price per share", with: "11.38")
      expect(page).to have_field("Number of shares", with: "0")

      expect(page).to have_table(with_rows: [
                                   {
                                     "Investor" => "You!",
                                     "Share class" => share_class.name,
                                     "Number of shares" => "100",
                                     "Bid price" => "$20.12",
                                   },
                                   {
                                     "Investor" => "You!",
                                     "Share class" => "Vested shares from equity grants",
                                     "Number of shares" => "3,000",
                                     "Bid price" => "$24.27",
                                   },
                                 ])

      within(:table_row, { "Number of shares" => "100" }) do
        click_on "Remove"
      end

      within("dialog") do
        expect(page).to have_text("Are you sure you want to cancel this bid?")
        expect(page).to have_text("Share class: #{share_class.name}")
        expect(page).to have_text("Number of shares: 100")
        expect(page).to have_text("Bid price: $20.12")

        click_button "Yes, cancel bid"
      end
      wait_for_ajax
      expect(page).not_to have_text("$20.12")
    end

    context "when investor is an AngelList investor" do
      before do
        company_investor_1.update!(invested_in_angel_list_ruv: true)
      end

      it "shows AngelList investor specific text" do
        visit spa_company_tender_offer_path(company.external_id, tender_offer.external_id)

        expect(page).to have_text(
          "Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV " \
          "itself. Please contact them for more information about this process."
        )
      end
    end
  end

  context "when logged in as a company administrator" do
    before do
      sign_in company_administrator.user
    end

    it "shows the expected details" do
      stub_const("TenderOfferPresenter::BIDS_PER_PAGE", 1)

      visit spa_company_tender_offer_path(company.external_id, tender_offer.external_id)

      # Header
      expect(page).to have_text('Tender offer details ("Sell Elections")')

      # Details
      expect(page).to have_text("#{starts_at.strftime("%b %-d, %Y")} Start date", normalize_ws: true)
      expect(page).to have_text("#{ends_at.strftime("%b %-d, %Y")} End date", normalize_ws: true)
      expect(page).to have_text("$100,000,000 Starting bid valuation", normalize_ws: true)

      # No text relating to placing bids
      expect(page).not_to have_text('Submit a bid ("Sell Order")')

      # Bids
      expect(page).to have_table(with_rows: [
                                   {
                                     "Investor" => company_investor_2.user.email,
                                     "Share class" => share_class.name,
                                     "Number of shares" => "50",
                                     "Bid price" => "$22.33",
                                   },
                                 ])
      within "[aria-label='Pagination']" do
        click_on "2"
      end
      expect(page).to have_table(with_rows: [
                                   {
                                     "Investor" => company_investor_1.user.email,
                                     "Share class" => share_class.name,
                                     "Number of shares" => "100",
                                     "Bid price" => "$20.12",
                                   },
                                 ])
      expect(page).to_not have_button("Remove")
    end
  end
end
