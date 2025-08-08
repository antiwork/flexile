# frozen_string_literal: true

class CreateCapTable
  attr_reader :errors, :company

  def initialize(company:, investors_data:)
    @company = company
    @investors_data = investors_data
    @errors = []
  end

  def perform
    return { success: false, errors: ["Company must have equity enabled"] } unless company.equity_enabled?

    validate_data
    return { success: false, errors: @errors } if @errors.any?

    ActiveRecord::Base.transaction do
      create_share_class_if_needed
      create_investors_and_holdings
    end

    # Update company shares after transaction commits (so ShareHolding callbacks have run)
    update_company_shares

    { success: true, errors: [] }
  rescue ActiveRecord::RecordInvalid => e
    @errors << e.message
    { success: false, errors: @errors }
  rescue StandardError => e
    @errors << "Unexpected error: #{e.message}"
    { success: false, errors: @errors }
  end

  private
    attr_reader :investors_data

    def validate_data
      return @errors << "No investors data provided" if investors_data.blank?

      total_shares = 0
      investors_data.each_with_index do |investor_data, index|
        user_id = investor_data[:userId]
        shares = investor_data[:shares].to_i

        if user_id.blank?
          @errors << "Investor #{index + 1}: User must be selected"
          next
        end

        if shares <= 0
          @errors << "Investor #{index + 1}: Shares must be greater than 0"
          next
        end

        user = User.find_by(external_id: user_id)
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

      if total_shares <= 0
        @errors << "Total shares must be greater than 0"
      end

      if company.fully_diluted_shares > 0 && total_shares > company.fully_diluted_shares
        @errors << "Total shares (#{total_shares}) cannot exceed company's fully diluted shares (#{company.fully_diluted_shares})"
      end
    end

    def create_share_class_if_needed
      return if company.share_classes.exists?(name: "Common")

      company.share_classes.create!(
        name: "Common",
        original_issue_price_in_dollars: company.share_price_in_usd || 0.01
      )
    end

    def create_investors_and_holdings
      share_class = company.share_classes.find_by!(name: "Common")
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
          share_holder_name: user.legal_name || user.preferred_name || user.email
        )
      end
    end

    def update_company_shares
      total_shares = company.company_investors.sum(:total_shares)
      company.update!(fully_diluted_shares: total_shares) if company.fully_diluted_shares.zero?
    end

    def generate_share_name(user)
      base_name = user.legal_name&.first&.upcase || user.preferred_name&.first&.upcase || "I"
      existing_count = company.share_holdings.where("name LIKE ?", "#{base_name}-%").count
      "#{base_name}-#{existing_count + 1}"
    end
end
