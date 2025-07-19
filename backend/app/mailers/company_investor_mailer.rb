# frozen_string_literal: true

class CompanyInvestorMailer < ApplicationMailer
  helper :application
  include ActiveSupport::NumberHelper
  default from: SUPPORT_EMAIL_WITH_NAME

  def dividend_issued(investor_dividend_round_id:)
    investor_dividend_round = InvestorDividendRound.find(investor_dividend_round_id)
    @dividend_round = investor_dividend_round.dividend_round
    @company_investor = investor_dividend_round.company_investor
    dividends = @dividend_round.dividends.where(company_investor_id: @company_investor.id)
    @user = @company_investor.user
    @company = @company_investor.company
    @gross_amount_in_cents = dividends.sum(:total_amount_in_cents)

    # If an investor is missing tax information, calculate the tax withholding and net amount
    if dividends.where(net_amount_in_cents: nil, withheld_tax_cents: nil).exists?
      tax_withholding_calculator = DividendTaxWithholdingCalculator.new(@company_investor, dividends:)
      @net_amount_in_cents = tax_withholding_calculator.net_cents
      @tax_amount_in_cents = tax_withholding_calculator.cents_to_withhold
    else
      @tax_amount_in_cents = dividends.sum(:withheld_tax_cents)
      @net_amount_in_cents = dividends.sum(:net_amount_in_cents)
    end

    mail(to: @user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "Upcoming #{@dividend_round.return_of_capital? ? "return of capital" : "distribution"} from #{@company.name}")
  end

  def dividend_payment(dividend_payment_id)
    @dividend_payment = DividendPayment.find(dividend_payment_id)
    @dividends = @dividend_payment.dividends.includes(:dividend_round)

    first_dividend = @dividends.first
    @company_investor = first_dividend.company_investor
    @dividend_round = first_dividend.dividend_round

    @net_cents, @tax_cents, @total_cents = @dividends.pluck(
      "SUM(net_amount_in_cents), SUM(withheld_tax_cents), SUM(dividends.total_amount_in_cents)"
    ).first
    @company = first_dividend.company
    @payment_date = first_dividend.paid_at.to_date
    @withholding_percentage =
      @dividends.pluck(:withholding_percentage).uniq.size == 1 ? first_dividend.withholding_percentage : nil

    mail(to: @company_investor.user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "You've got a #{@dividend_round.return_of_capital? ? "return of capital" : "distribution"} from #{@company.name}")
  end

  def equity_buyback_payment(equity_buyback_payment_id:)
    @equity_buyback_payment = EquityBuybackPayment.find(equity_buyback_payment_id)
    @equity_buybacks = @equity_buyback_payment.equity_buybacks

    first_equity_buyback = @equity_buybacks.first
    company_investor = first_equity_buyback.company_investor

    @total_cents = @equity_buybacks.sum(:total_amount_cents)
    @company = first_equity_buyback.company
    @payment_date = first_equity_buyback.paid_at.to_date

    mail(to: company_investor.user.email,
         subject: "💰 Distribution for your equity backback from #{@company.display_name}")
  end

  def confirm_tax_info_reminder(company_investor_id, by_date:)
    company_investor = CompanyInvestor.find(company_investor_id)
    user = company_investor.user
    @company = company_investor.company
    @withholding_percentage = TaxWithholdingCalculator.new(user).withholding_percentage
    @by_date = by_date.to_date

    mail(to: user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "🔴 Action needed: Confirm your tax information")
  end

  def retained_dividends(company_investor_id, total_cents:, net_cents:, withholding_percentage:)
    @company_investor = CompanyInvestor.find(company_investor_id)
    @user = @company_investor.user
    @company = @company_investor.company
    @dividend_amount_in_cents = total_cents
    @roi = @dividend_amount_in_cents / @company_investor.investment_amount_in_cents.to_d
    @net_amount_in_cents = net_cents
    @withholding_percentage = withholding_percentage

    mail(to: @user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "Your distribution from #{@company.name} is on hold")
  end

  def sanctioned_dividends(company_investor_id, dividend_amount_in_cents:)
    @company_investor = CompanyInvestor.find(company_investor_id)
    @company = @company_investor.company
    @dividend_amount_in_cents = dividend_amount_in_cents

    mail(to: @company_investor.user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "Your distribution from #{@company.name} has been retained due to international sanctions")
  end

  def stock_exercise_payment_instructions(company_investor_id, exercise_id:)
    company_investor = CompanyInvestor.find(company_investor_id)
    @company = company_investor.company
    @exercise = company_investor.equity_grant_exercises.find(exercise_id)
    @user = company_investor.user
    @account_details = @exercise.bank_account.all_details

    mail(to: @user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "🔴 Action needed: your stock options exercise")
  end

  def stock_exercise_success(company_investor_id, share_holding_id:)
    company_investor = CompanyInvestor.find(company_investor_id)
    @company = company_investor.company
    @share_holding = company_investor.share_holdings.find(share_holding_id)
    ownership = company_investor.share_holdings.sum(:number_of_shares) * 100.to_d / @company.fully_diluted_shares
    @ownership_percentage = number_to_percentage(ownership, precision: 3)
    @is_new_shareholder = company_investor.share_holdings.one?

    mail(to: company_investor.user.email,
         reply_to: SUPPORT_EMAIL_WITH_NAME,
         subject: "🎊 Your stock options are officially exercised")
  end

  def tender_offer_opened(company_investor_id, tender_offer_id:)
    company_investor = CompanyInvestor.find(company_investor_id)
    user = company_investor.user
    @tender_offer = TenderOffer.find(tender_offer_id)
    mail(to: user.email, subject: "New stock buyback available")
  end

  def tender_offer_closed(company_investor_id, tender_offer_id:)
    user = CompanyInvestor.find(company_investor_id).user
    @tender_offer = TenderOffer.find(tender_offer_id)
    @company = @tender_offer.company
    tender_offer_bids = @tender_offer.bids.where(company_investor_id:)

    @total_number_of_shares = tender_offer_bids.sum(:accepted_shares).to_i
    @accepted_price_cents = @tender_offer.accepted_price_cents
    @total_amount_received = @total_number_of_shares * @accepted_price_cents if @total_number_of_shares > 0

    mail(to: user.email, subject: "Stock buyback results")
  end

  def tender_offer_reminder(company_investor_id, tender_offer_id:)
    company_investor = CompanyInvestor.find(company_investor_id)
    user = company_investor.user
    @tender_offer = TenderOffer.find(tender_offer_id)
    mail(to: user.email, subject: "Reminder: stock buyback available")
  end

  def dividend_payment_failed_reenter_bank_details(dividend_payment_id:, amount:, currency:, net_amount_in_usd_cents:)
    @dividend_payment = DividendPayment.find(dividend_payment_id)
    @net_amount_in_usd_cents = net_amount_in_usd_cents

    @amount = amount
    @currency = currency

    company_investor = @dividend_payment.dividends.first.company_investor

    @user = company_investor.user
    @company = company_investor.company

    mail(to: @user.email,
         subject: "🔴 Action needed: Update your bank details to receive your distribution")
  end

  def equity_buyback_payment_failed_reenter_bank_details(equity_buyback_payment_id:, amount:,
                                                         currency:, net_amount_in_usd_cents:)
    @equity_buyback_payment = EquityBuybackPayment.find(equity_buyback_payment_id)
    @net_amount_in_usd_cents = net_amount_in_usd_cents

    @amount = amount
    @currency = currency

    company_investor = @equity_buyback_payment.equity_buybacks.first.company_investor
    user = company_investor.user
    @company = company_investor.company

    mail(to: user.email,
         subject: "🔴 Equity buyback payment failed: re-enter your bank details")
  end

  def dividend_payment_failed(user, dividend_payment)
    @user = user
    @payment = dividend_payment

    mail(
      to: @user.email,
      subject: "🔴 Action required: Your dividend payment failed"
    )
  end
end
