# frozen_string_literal: true

class TenderOffers::CalculateEquilibriumPrice
  def initialize(tender_offer:, total_amount_cents: nil, total_shares: nil)
    @tender_offer = tender_offer
    @total_shares = total_shares || tender_offer.number_of_shares
    @total_amount = total_amount_cents || tender_offer.total_amount_in_cents
  end

  def perform
    return if Time.current <= tender_offer.ends_at

    bids = tender_offer_bids
    return if bids.empty?

    equilibrium_price, best_allocation = find_equilibrium_price(bids)

    if equilibrium_price
      print_allocation(equilibrium_price,
                       best_allocation[:investor_allocations],
                       best_allocation[:shares],
                       best_allocation[:amount])
      save_accepted_shares(equilibrium_price, best_allocation[:investor_allocations])
    end

    equilibrium_price
  end

  private
    attr_reader :tender_offer, :total_amount, :total_shares

    def tender_offer_bids = tender_offer.bids

    def find_equilibrium_price(bids)
      sorted_bids = bids.sort_by(&:share_price_cents)
      return [nil, nil] if sorted_bids.empty?

      best_price = nil
      best_allocation = { shares: 0, amount: 0, investor_allocations: {} }

      investor_limits = calculate_investor_limits

      sorted_bids.each do |bid|
        price = bid.share_price_cents
        allocated_shares, allocated_amount, investor_allocations =
          allocate_shares(sorted_bids, price, investor_limits.deep_dup)

        puts "Price: #{price}"
        puts "Allocated shares: #{allocated_shares}"
        puts "Allocated amount: #{allocated_amount}"

        if allocated_shares > best_allocation[:shares] && allocated_shares <= total_shares &&
          allocated_amount <= total_amount
          best_price = price
          best_allocation = {
            shares: allocated_shares,
            amount: allocated_amount,
            investor_allocations: investor_allocations,
          }
        elsif allocated_shares > total_shares || allocated_amount > total_amount
          break
        end

        puts "Best price: #{best_price}"
        puts "---"
      end

      [best_price, best_allocation]
    end

    def calculate_investor_limits
      limits = {}
      tender_offer_bids.group_by(&:company_investor_id).each do |investor_id, investor_bids|
        securities = tender_offer.securities_available_for_purchase(investor_bids.first.company_investor)
        limits[investor_id] = {
          by_class: securities.each_with_object(Hash.new(0)) { |s, hash| hash[s[:class_name]] = s[:count] },
        }
      end
      limits
    end

    def allocate_shares(bids, price, investor_limits)
      eligible_bids = bids.select { |bid| bid.share_price_cents <= price }
      return [0, 0, {}] if eligible_bids.empty?

      grouped_bids = eligible_bids.group_by(&:company_investor_id)

      class_allocations = {}
      total_bid_shares = grouped_bids.sum do |investor_id, investor_bids|
        class_allocations[investor_id] = investor_bids.each_with_object(
          Hash.new { |h, k| h[k] = { bid_shares: 0, allocated: 0 } }
        ) do |bid, hash|
          available_shares = investor_limits[investor_id][:by_class][bid.share_class]
          bid_shares = [bid.number_of_shares, available_shares - hash[bid.share_class][:bid_shares]].min
          hash[bid.share_class][:bid_shares] += bid_shares
        end
        class_allocations[investor_id].values.sum { |v| v[:bid_shares] }
      end

      return [0, 0, {}] if total_bid_shares.zero?

      allocation_ratio = [
        total_shares / total_bid_shares.to_f,
        total_amount / (total_bid_shares * price).to_f,
        1
      ].min

      allocated_shares = 0
      allocated_amount = 0
      investor_allocations = Hash.new { |h, k| h[k] = Hash.new(0) }

      grouped_bids.each do |investor_id, investor_bids|
        eligible_investor_bid_shares = class_allocations[investor_id].values.sum { |v| v[:bid_shares] }

        shares_to_allocate = [
          (eligible_investor_bid_shares * allocation_ratio).floor,
          investor_limits[investor_id][:by_class].values.sum,
          total_shares - allocated_shares,
          ((total_amount - allocated_amount) / price.to_f).floor
        ].min

        allocated_shares += shares_to_allocate
        allocated_amount += shares_to_allocate * price

        class_allocations[investor_id].each do |share_class, data|
          allocation = (shares_to_allocate * data[:bid_shares] / eligible_investor_bid_shares.to_f).floor
          data[:allocated] = allocation
        end

        remaining_shares = shares_to_allocate - class_allocations[investor_id].sum { |_, data| data[:allocated] }
        remaining_shares.times do
          class_with_highest_ratio = class_allocations[investor_id].max_by do |_, data|
            (data[:bid_shares] - data[:allocated]) / data[:bid_shares].to_f
          end.first
          class_allocations[investor_id][class_with_highest_ratio][:allocated] += 1
        end

        class_allocations[investor_id].each do |share_class, data|
          investor_allocations[investor_id][share_class] = data[:allocated]
        end
      end

      [allocated_shares, allocated_amount, investor_allocations]
    end

    def print_allocation(price, investor_allocations, allocated_shares, allocated_amount)
      investor_allocations.each do |investor_id, allocations|
        investor_email = CompanyInvestor.find(investor_id).user.email
        puts "Investor: #{investor_email}"
        allocations.each do |share_class, shares|
          puts "  #{share_class}: #{shares} shares"
        end
      end
      formatted_amount = Money.from_cents(allocated_amount, :usd).format(symbol: true, thousands_separator: ",")
      formatted_shares = ActiveSupport::NumberHelper.number_to_delimited(allocated_shares)
      formatted_price = Money.from_cents(price, :usd).format(symbol: true, thousands_separator: ",")
      puts "---"
      puts "Total shares allocated: #{formatted_shares}"
      puts "Total amount allocated: #{formatted_amount}"
      puts "Equilibrium price: #{formatted_price}"
      puts "---"
    end

    def save_accepted_shares(price, investor_allocations)
      tender_offer.update!(accepted_price_cents: price)
      tender_offer.bids.update_all(accepted_shares: 0) # Reset all bids' accepted_shares to 0

      investor_allocations.each do |investor_id, allocations|
        investor_bids = tender_offer_bids.where(company_investor_id: investor_id).where("share_price_cents <= ?", price).order(:created_at)

        allocations.each do |share_class, accepted_shares|
          remaining_shares = accepted_shares

          investor_bids.where(share_class: share_class).each do |bid|
            shares_to_accept = [remaining_shares, bid.number_of_shares].min
            bid.update!(accepted_shares: shares_to_accept)
            remaining_shares -= shares_to_accept
            break if remaining_shares.zero?
          end
        end
      end
    end
end

# TenderOffers::CalculateEquilibriumPrice.new(tender_offer: TenderOffer.sole, total_amount_cents: 1_000_000_00).perform
