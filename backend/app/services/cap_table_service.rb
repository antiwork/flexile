# frozen_string_literal: true

class CapTableService
  def initialize(company:, new_schema: false)
    @company = company
    @new_schema = new_schema
  end

  def generate
    {
      investors:,
      option_pools:,
      share_classes:,
      exercise_prices:,
      outstanding_shares: investors.sum { _1[:outstanding_shares] || 0 },
      fully_diluted_shares: company.fully_diluted_shares,
    }
  end

  private
    attr_reader :company, :new_schema

    def investors
      entities = company.send(company_investors_table_meta[:table_name]).includes(:user)

      total_options_by_entity = EquityGrant.joins(company_investors_table_meta[:table_name].singularize.to_sym)
        .where({ company_investors_table_meta[:table_name].to_sym => { company: } })
        .group("#{company_investors_table_meta[:table_name]}.id")
        .sum("vested_shares + unvested_shares")

      potential_investors = entities.map do |entity|
        total_options = total_options_by_entity[entity.id] || 0
        {
          entity:,
          outstanding_shares: entity.total_shares,
          total_options:,
        }
      end

      investors_data = []

      potential_investors
        .select { _1[:outstanding_shares] > 0 || _1[:total_options] > 0 }
        .sort_by { [-_1[:outstanding_shares], -_1[:total_options]] }
        .each do |investor|
          entity = investor[:entity]
          fully_diluted_shares = investor[:outstanding_shares] + investor[:total_options]

          investors_data << {
            id: entity.external_id,
            name: new_schema ? entity.name : (entity.user.legal_name || ""),
            outstanding_shares: investor[:outstanding_shares],
            fully_diluted_shares:,
            email: new_schema ? entity.email : entity.user.email,
          }
        end

      company.convertible_investments
      .order(implied_shares: :desc)
      .each do |investment|
        investors_data << {
          name: "#{investment.entity_name} #{investment.convertible_type}",
          outstanding_shares: 0,
          fully_diluted_shares: 0,
        }
      end

      option_pools.each do |pool|
        investors_data << {
          name: "Options available (#{pool[:name]})",
          outstanding_shares: 0,
          fully_diluted_shares: pool[:available_shares],
        }
      end

      investor_ids = investors_data.filter_map { _1[:id] }

      default_shares_by_class = share_classes.map { _1[:name] }.index_with { 0 }
      default_options_by_strike = exercise_prices.index_with { 0 }

      if investor_ids.any?
        shares_by_investor = all_shares_by_class(investor_ids, share_classes)
        options_by_investor = all_options_by_strike(investor_ids, exercise_prices)

        investors_data.each do |investor|
          next unless investor[:id]

          investor[:shares_by_class] = shares_by_investor[investor[:id]]
          investor[:options_by_strike] = options_by_investor[investor[:id]]
        end
      end

      investors_data.each do |investor|
        investor[:shares_by_class] ||= default_shares_by_class
        investor[:options_by_strike] ||= default_options_by_strike
      end

      investors_data
    end

    def option_pools
      @_option_pools ||= company.option_pools.map do |pool|
        {
          id: pool.id,
          name: pool.name,
          available_shares: pool.available_shares,
        }
      end
    end

    def share_classes
      @_share_classes ||= company.share_classes
        .includes(:share_holdings)
        .map do |share_class|
          outstanding_shares = share_class.share_holdings.sum(:number_of_shares)
          pool_ids = company.option_pools.where(share_class:).pluck(:id)
          exercisable_shares = EquityGrant.where(option_pool_id: pool_ids).sum("vested_shares + unvested_shares")
          {
            id: share_class.id,
            name: share_class.name,
            outstanding_shares: outstanding_shares,
            fully_diluted_shares: outstanding_shares + exercisable_shares,
          }
        end
    end

    def exercise_prices
      @_exercise_prices ||=
      EquityGrant.joins(:option_pool)
        .where(option_pools: { company: })
        .distinct
        .pluck(:exercise_price_usd)
        .sort
    end

    def all_shares_by_class(investor_ids, share_classes)
      return {} if investor_ids.empty?

      holdings = ShareHolding.joins(company_investors_table_meta[:table_name].singularize.to_sym, :share_class)
        .where({ company_investors_table_meta[:table_name].to_sym => { external_id: investor_ids } })
        .where(share_classes: { company: })
        .group("#{company_investors_table_meta[:table_name]}.external_id", "share_classes.name")
        .sum(:number_of_shares)

      result = {}
      investor_ids.each do |investor_id|
        result[investor_id] = {}
        share_classes.each do |share_class|
          result[investor_id][share_class[:name]] = holdings[[investor_id, share_class[:name]]] || 0
        end
      end

      result
    end

    def all_options_by_strike(investor_ids, exercise_prices)
      return {} if investor_ids.empty?

      grants = EquityGrant
          .joins("INNER JOIN option_pools ON equity_grants.option_pool_id = option_pools.id")
          .joins("INNER JOIN #{company_investors_table_meta[:table_name]} ON equity_grants.#{company_investors_table_meta[:id_column_name]} = #{company_investors_table_meta[:table_name]}.id")
          .where("#{company_investors_table_meta[:table_name]}.external_id IN (?)", investor_ids)
          .where("equity_grants.exercise_price_usd IN (?)", exercise_prices)
          .where("option_pools.company_id = ?", company.id)
          .group("#{company_investors_table_meta[:table_name]}.external_id", "equity_grants.exercise_price_usd")
          .sum("equity_grants.vested_shares")

      result = {}
      investor_ids.each do |investor_id|
        result[investor_id] = {}
        exercise_prices.each do |price|
          grant_value = grants[[investor_id, price]] || 0
          result[investor_id][price] = grant_value
        end
      end

      result
    end

    def company_investors_table_meta
      @_company_investors_table_meta ||=
        {
          table_name: new_schema ? "company_investor_entities" : "company_investors",
          id_column_name: new_schema ? "company_investor_entity_id" : "company_investor_id",
        }
    end
end
