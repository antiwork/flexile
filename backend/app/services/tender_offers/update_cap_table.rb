# frozen_string_literal: true

class TenderOffers::UpdateCapTable
  def initialize(equity_buyback_round:)
    @equity_buyback_round = equity_buyback_round
    @company = equity_buyback_round.company
    @option_pool = @company.option_pools.sole
    @shares_sold = 0
    @options_sold = 0
  end

  def perform
    share_holdings = []

    ApplicationRecord.transaction do
      equity_buyback_round.equity_buybacks.includes(:security).each do |equity_buyback|
        security = equity_buyback.security

        if security.is_a?(EquityGrant)
          update_equity_grant(equity_buyback, security)
        elsif security.is_a?(ShareHolding)
          update_share_holding(equity_buyback, security)
          share_holdings << security
        else
          raise "Unsupported security type: #{security.class}"
        end
      end

      company.with_lock do
        company.update!(fully_diluted_shares: company.fully_diluted_shares - shares_sold)
      end
      option_pool.with_lock do
        option_pool.update!(issued_shares: option_pool.issued_shares - options_sold)
      end

      share_holdings.map(&:company_investor_id).uniq.each do |company_investor_id|
        company_investor = CompanyInvestor.find(company_investor_id)
        company_investor.user.documents.share_certificate.where(company_id: company_investor.company_id).destroy_all
        company_investor.share_holdings.find_each(&:create_share_certificate)
      end
    end
  end

  private
    attr_reader :equity_buyback_round, :shares_sold, :options_sold, :company, :option_pool

    def update_equity_grant(equity_buyback, equity_grant)
      equity_grant.with_lock do
        equity_grant.update!(
          vested_shares: equity_grant.vested_shares - equity_buyback.number_of_shares,
          forfeited_shares: equity_grant.forfeited_shares + equity_buyback.number_of_shares
        )
      end
      @options_sold += equity_buyback.number_of_shares
    end

    def update_share_holding(equity_buyback, share_holding)
      share_holding.with_lock do
        share_holding.update!(number_of_shares: share_holding.number_of_shares - equity_buyback.number_of_shares)
      end
      @shares_sold += equity_buyback.number_of_shares
    end
end

# tender_offer = TenderOffer.sole
# TenderOffers::UpdateCapTable.new(equity_buyback_round: tender_offer.equity_buyback_rounds.sole).perform
