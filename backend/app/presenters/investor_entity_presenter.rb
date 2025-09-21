# frozen_string_literal: true

class InvestorEntityPresenter
  RECORDS_PER_SECTION = 20

  def initialize(investor_entity)
    @investor_entity = investor_entity
  end

  def props
    {
      id: @investor_entity.external_id,
      name: @investor_entity.name,
      grants: grants_props,
      shares: shares_props,
    }
  end

  private
    def grants_props
      @investor_entity.equity_grants
        .where("vested_shares > 0 OR unvested_shares > 0 OR exercised_shares = 0")
        .order(issued_at: :desc)
        .limit(RECORDS_PER_SECTION)
        .select(:issued_at, :number_of_shares, :vested_shares, :unvested_shares, :exercised_shares, :vested_amount_usd, :exercise_price_usd)
        .map do |grant|
          {
            issuedAt: grant.issued_at,
            numberOfShares: grant.number_of_shares,
            vestedShares: grant.vested_shares,
            unvestedShares: grant.unvested_shares,
            exercisedShares: grant.exercised_shares,
            vestedAmountUsd: grant.vested_amount_usd&.to_f,
            exercisePriceUsd: grant.exercise_price_usd.to_f,
          }
        end
    end

    def shares_props
      @investor_entity.share_holdings
        .order(id: :desc)
        .limit(RECORDS_PER_SECTION)
        .select(:issued_at, :name, :number_of_shares, :share_price_usd, :total_amount_in_cents)
        .map do |share|
          {
            issuedAt: share.issued_at,
            shareType: share.name,
            numberOfShares: share.number_of_shares,
            sharePriceUsd: share.share_price_usd.to_f,
            totalAmountInCents: share.total_amount_in_cents,
          }
        end
    end
end
