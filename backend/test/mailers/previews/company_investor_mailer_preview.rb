# frozen_string_literal: true

class CompanyInvestorMailerPreview < ActionMailer::Preview
  def dividend_payment_failed
    user = User.first
    dividend_payment = DividendPayment.last

    CompanyInvestorMailer.dividend_payment_failed(user, dividend_payment)
  end

  def dividend_issued
    CompanyInvestorMailer.dividend_issued(investor_dividend_round_id: InvestorDividendRound.first.id)
  end

  def dividend_payment
    dividend_payment = Dividend.paid.where(withheld_tax_cents: 0).last.dividend_payments.last
    CompanyInvestorMailer.dividend_payment(dividend_payment.id)
  end

  def equity_buyback_payment
    CompanyInvestorMailer.equity_buyback_payment(equity_buyback_payment_id: EquityBuybackPayment.last.id)
  end

  def dividend_payment_with_tax
    dividend_payment = Dividend.paid.where.not(withheld_tax_cents: 0).last.dividend_payments.last
    CompanyInvestorMailer.dividend_payment(dividend_payment.id)
  end

  def confirm_tax_info_reminder
    CompanyInvestorMailer.confirm_tax_info_reminder(CompanyInvestor.last.id, by_date: 1.month.from_now)
  end

  def retained_dividends
    investor = CompanyInvestor.last
    CompanyInvestorMailer.retained_dividends(investor.id, total_cents: 6_00,
                                                          net_cents: 6_00,
                                                          withholding_percentage: 0)
  end

  def retained_dividends_with_withholding
    investor = CompanyInvestor.last
    CompanyInvestorMailer.retained_dividends(investor.id, total_cents: 10_00,
                                                          net_cents: 7_60,
                                                          withholding_percentage: 24)
  end

  def sanctioned_dividends
    CompanyInvestorMailer.sanctioned_dividends(CompanyInvestor.last.id, dividend_amount_in_cents: 60_00)
  end

  def stock_exercise_payment_instructions
    exercise = EquityGrantExercise.last
    company_investor_id = exercise.company_investor_id
    CompanyInvestorMailer.stock_exercise_payment_instructions(company_investor_id, exercise_id: exercise.id)
  end

  def stock_exercise_success
    share_holding = ShareHolding.last
    company_investor_id = share_holding.company_investor_id
    CompanyInvestorMailer.stock_exercise_success(company_investor_id, share_holding_id: share_holding.id)
  end

  def tender_offer_opened
    company_investor = CompanyInvestor.last
    tender_offer = TenderOffer.last
    CompanyInvestorMailer.tender_offer_opened(company_investor.id, tender_offer_id: tender_offer.id)
  end

  def tender_offer_closed
    tender_offer = TenderOffer.where.not(accepted_price_cents: nil).last
    company_investor = CompanyInvestor.joins(:tender_offer_bids).where(tender_offer_bids: { tender_offer_id: tender_offer.id })
                                      .group(:id).select("company_investors.id, sum(tender_offer_bids.accepted_shares)")
                                      .having("sum(tender_offer_bids.accepted_shares) = 0").first
    CompanyInvestorMailer.tender_offer_closed(company_investor.id, tender_offer_id: tender_offer.id)
  end

  def tender_offer_closed_non_participating
    tender_offer = TenderOffer.where.not(accepted_price_cents: nil).last
    company_investor = CompanyInvestor.joins(:tender_offer_bids).where(tender_offer_bids: { tender_offer_id: tender_offer.id })
                                      .group(:id).select("company_investors.id, sum(tender_offer_bids.accepted_shares)")
                                      .having("sum(tender_offer_bids.accepted_shares) > 0").first
    CompanyInvestorMailer.tender_offer_closed(company_investor.id, tender_offer_id: tender_offer.id)
  end

  def dividend_payment_failed_reenter_bank_details
    dividend_payment = DividendPayment.last
    dividends = dividend_payment.dividends

    currency = dividends.first.company_investor.user.bank_account_for_dividends.currency
    rate = Wise::PayoutApi.new.get_exchange_rate(target_currency: currency).first["rate"]
    net_amount_in_usd_cents = dividends.sum(:net_amount_in_cents)
    amount = (net_amount_in_usd_cents / 100.0) * rate

    CompanyInvestorMailer.dividend_payment_failed_reenter_bank_details(
      dividend_payment_id: dividend_payment.id,
      amount: amount,
      currency: currency,
      net_amount_in_usd_cents: net_amount_in_usd_cents
    )
  end

  def equity_buyback_payment_failed_reenter_bank_details
    equity_buyback_payment = EquityBuybackPayment.last
    equity_buybacks = equity_buyback_payment.equity_buybacks

    currency = equity_buybacks.first.company_investor.user.bank_account_for_dividends.currency
    rate = Wise::PayoutApi.new.get_exchange_rate(target_currency: currency).first["rate"]
    net_amount_in_usd_cents = equity_buybacks.sum(:total_amount_cents)
    amount = (net_amount_in_usd_cents / 100.0) * rate

    CompanyInvestorMailer.equity_buyback_payment_failed_reenter_bank_details(
      equity_buyback_payment_id: equity_buyback_payment.id,
      amount:,
      currency:,
      net_amount_in_usd_cents:,
    )
  end

  def tender_offer_reminder
    company_investor = CompanyInvestor.last
    tender_offer = TenderOffer.last
    CompanyInvestorMailer.tender_offer_reminder(company_investor.id, tender_offer_id: tender_offer.id)
  end
end
