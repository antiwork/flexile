# frozen_string_literal: true

require "rails_helper"

describe Internal::DividendsController, type: :request do
  let(:user) { create(:user, :with_dividend_bank_account) }
  let(:company) { create(:company) }
  let(:company_investor) { create(:company_investor, user: user, company: company) }
  let(:dividend_round) { create(:dividend_round, company: company) }
  let(:dividend) { create(:dividend, :with_tax, dividend_round: dividend_round, company: company, company_investor: company_investor) }

  before do
    sign_in user
  end

  it "returns the correct dividend data for the current user" do
    get "/internal/dividends/#{dividend.id}"
    expect(response).to be_successful
    json = JSON.parse(response.body)
    expect(json).to include(
      "total_amount_in_cents" => dividend.total_amount_in_cents,
      "cumulative_return" => (company_investor.dividends.sum(:total_amount_in_cents).to_f / company_investor.investment_amount_in_cents).round(4),
      "withheld_tax_cents" => dividend.withheld_tax_cents,
      "bank_account_last_4" => user.bank_account_for_dividends.last_four_digits,
      "release_agreement" => dividend_round.release_document
    )
  end

  it "returns 404 if the dividend does not belong to the user" do
    other_user = create(:user)
    other_investor = create(:company_investor, user: other_user, company: company)
    other_dividend = create(:dividend, dividend_round: dividend_round, company: company, company_investor: other_investor)
    get "/internal/dividends/#{other_dividend.id}"
    expect(response).to have_http_status(:not_found)
  end

  it "returns 401 if not authenticated" do
    sign_out user
    get "/internal/dividends/#{dividend.id}"
    expect(response).to have_http_status(:unauthorized)
  end
end
