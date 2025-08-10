# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Dividend Duplicate Prevention", type: :model do
  let(:company) { create(:company) }
  let(:company_investor) { create(:company_investor, company:) }
  let(:dividend_round) { create(:dividend_round, company:) }

  describe "unique constraint validation" do
    it "prevents duplicate dividends for same investor and round" do
      # Create first dividend
      create(:dividend, company_investor:, dividend_round:)

      # Force failure on attempt to create duplicate
      expect do
        create(:dividend, company_investor:, dividend_round:)
      end.to raise_error(ActiveRecord::RecordInvalid)
    end

    it "allows different investors to have dividends in same round" do
      other_investor = create(:company_investor, company:)

      dividend1 = create(:dividend, company_investor:, dividend_round:)
      dividend2 = create(:dividend, company_investor: other_investor, dividend_round:)

      expect(dividend1).to be_persisted
      expect(dividend2).to be_persisted
    end

    it "allows same investor to have dividends in different rounds" do
      other_round = create(:dividend_round, company:)

      dividend1 = create(:dividend, company_investor:, dividend_round:)
      dividend2 = create(:dividend, company_investor:, dividend_round: other_round)

      expect(dividend1).to be_persisted
      expect(dividend2).to be_persisted
    end
  end

  describe "safe creation method" do
    it "creates new dividend when none exists" do
      dividend = Dividend.find_or_create_for_investor_and_round!(
        company_investor:,
        dividend_round:,
        attributes: { total_amount_in_cents: 10000, qualified_amount_cents: 10000, status: "Issued" }
      )

      expect(dividend).to be_persisted
      expect(dividend.total_amount_in_cents).to eq(10000)
    end

    it "returns existing dividend when one exists" do
      existing = create(:dividend, company_investor:, dividend_round:, total_amount_in_cents: 5000)

      dividend = Dividend.find_or_create_for_investor_and_round!(
        company_investor:,
        dividend_round:,
        attributes: { total_amount_in_cents: 10000, qualified_amount_cents: 10000, status: "Issued" }
      )

      expect(dividend.id).to eq(existing.id)
      expect(dividend.total_amount_in_cents).to eq(5000) # Original amount preserved
    end

    it "handles race conditions gracefully" do
      # Simulate race condition by creating dividend in separate thread
      dividend1 = nil
      dividend2 = nil

      threads = [
        Thread.new do
          dividend1 = Dividend.find_or_create_for_investor_and_round!(
            company_investor:,
            dividend_round:,
            attributes: { total_amount_in_cents: 10000, qualified_amount_cents: 10000, status: "Issued" }
          )
        end,
        Thread.new do
          dividend2 = Dividend.find_or_create_for_investor_and_round!(
            company_investor:,
            dividend_round:,
            attributes: { total_amount_in_cents: 15000, qualified_amount_cents: 15000, status: "Issued" }
          )
        end
      ]

      threads.each(&:join)

      expect(dividend1).to be_persisted
      expect(dividend2).to be_persisted
      expect(dividend1.id).to eq(dividend2.id) # Should be same dividend
    end
  end
end
