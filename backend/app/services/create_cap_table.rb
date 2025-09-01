# frozen_string_literal: true

class CreateCapTable
  def initialize(company:, investors_data:)
    @company = company
    @investors_data = investors_data
    @errors = []
  end

  def perform
    return { success: false, errors: ["Company must have equity enabled"] } unless company.equity_enabled?
    unless company.cap_table_empty?
      return { success: false, errors: ["Company already has cap table data"] }
    end

    validate_data
    return { success: false, errors: @errors } if @errors.any?

    ApplicationRecord.transaction do
      company.share_classes.create!(name: ShareClass::DEFAULT_NAME)
      create_investors_and_holdings
    end

    # Update company shares after transaction commits (so ShareHolding callbacks have run)
    update_company_shares

    { success: true, errors: [] }
  rescue ActiveRecord::RecordInvalid => e
    @errors << e.message
    { success: false, errors: @errors }
  rescue => e
    @errors << "Unexpected error: #{e.message}"
    { success: false, errors: @errors }
  end

  private
    attr_reader :errors, :company, :investors_data

    def validate_data
      total_shares = 0
      investors_data.each_with_index do |investor_data, index|
        user = User.find_by(external_id: investor_data[:userId])
        shares = investor_data[:shares].to_i

        if user.nil?
          @errors << "Investor #{index + 1}: User not found"
          next
        end

        if company.company_investors.exists?(user: user)
          @errors << "Investor #{index + 1}: User is already an investor in this company"
          next
        end

        total_shares += shares
      end

      if company.fully_diluted_shares > 0 && total_shares > company.fully_diluted_shares
        @errors << "Total shares (#{total_shares}) cannot exceed company's fully diluted shares (#{company.fully_diluted_shares})"
      end
    end

    def create_investors_and_holdings
      share_class = company.share_classes.find_by!(name: ShareClass::DEFAULT_NAME)
      share_price = company.share_price_in_usd || 0.01

      investors_data.each do |investor_data|
        user = User.find_by!(external_id: investor_data[:userId])
        shares = investor_data[:shares].to_i
        investment_amount_cents = (shares * share_price * 100).to_i

        # Create company investor (total_shares will be set by ShareHolding callbacks)
        company_investor = company.company_investors.create!(
          user: user,
          investment_amount_in_cents: investment_amount_cents,
          total_shares: 0
        )

        # Create share holding
        company_investor.share_holdings.create!(
          share_class: share_class,
          name: generate_share_name(user),
          issued_at: Time.current,
          originally_acquired_at: Time.current,
          number_of_shares: shares,
          share_price_usd: share_price,
          total_amount_in_cents: investment_amount_cents,
          share_holder_name: option_holder_name(user)
        )
      end
    end

    def update_company_shares
      total_shares = company.company_investors.sum(:total_shares)
      company.update!(fully_diluted_shares: total_shares) if company.fully_diluted_shares.zero?
    end

    def generate_share_name(user)
      # Use same logic as EquityGrantCreation#next_grant_name
      preceding_holding = company.share_holdings.order(id: :desc).first
      return "#{company.name.first(3).upcase}-1" if preceding_holding.nil?

      preceding_holding_digits = preceding_holding.name.scan(/\d+\z/).last
      preceding_holding_number = preceding_holding_digits.to_i

      next_holding_number = preceding_holding_number + 1
      preceding_holding.name.reverse.sub(preceding_holding_digits.reverse, next_holding_number.to_s.reverse).reverse
    end

    def option_holder_name(user)
      # Use same logic as EquityGrantCreation#option_holder_name
      return user.legal_name unless user.business_entity?

      if ISO3166::Country[:IN] == ISO3166::Country[user.country_code]
        user.legal_name
      else
        user.business_name
      end
    end
end
