# frozen_string_literal: true

class Onetime::PopulateCompanyInvestorEntities
  def perform
    Company.find_each do |company|
      process_company(company)
    end
  end

  private
    def process_company(company)
      entity_data = {}

      process_shareholdings(company, entity_data)
      process_equity_grants(company, entity_data)

      create_company_investor_entities(company, entity_data)
      update_shareholdings_and_equity_grants(company, entity_data)
    end

    def process_shareholdings(company, entity_data)
      company.share_holdings.find_each do |shareholding|
        company_investor = shareholding.company_investor
        key = [company.id, shareholding.share_holder_name]
        entity_data[key] = initialize_entity_data(shareholding.share_holder_name) unless entity_data.key?(key)
        entity_data[key][:total_shares] += shareholding.number_of_shares
        entity_data[key][:investment_amount_cents] += shareholding.total_amount_in_cents
        entity_data[key][:cap_table_notes] << company_investor.cap_table_notes
        entity_data[key][:shareholdings] << shareholding
        entity_data[key][:emails] << company_investor.user.email
      end
    end

    def process_equity_grants(company, entity_data)
      company.equity_grants.find_each do |equity_grant|
        company_investor = equity_grant.company_investor
        key = [company.id, equity_grant.option_holder_name]
        entity_data[key] = initialize_entity_data(equity_grant.option_holder_name) unless entity_data.key?(key)
        entity_data[key][:total_options] += equity_grant.number_of_shares
        entity_data[key][:cap_table_notes] << company_investor.cap_table_notes
        entity_data[key][:equity_grants] << equity_grant
        entity_data[key][:emails] << company_investor.user.email
      end
    end

    def create_company_investor_entities(company, entity_data)
      entity_data.each do |key, data|
        company_id, name = key

        cap_table_notes = determine_cap_table_notes(data[:cap_table_notes])
        email = data[:emails].compact.first

        entity = CompanyInvestorEntity.create!(
          company_id:,
          name:,
          investment_amount_cents: data[:investment_amount_cents],
          total_shares: data[:total_shares],
          total_options: data[:total_options],
          cap_table_notes:,
          email:
        )

        data[:entity] = entity
      end
    end

    def update_shareholdings_and_equity_grants(company, entity_data)
      entity_data.each do |_, data|
        entity = data[:entity]

        data[:shareholdings].each do |shareholding|
          shareholding.update_columns(company_investor_entity_id: entity.id)
        end

        data[:equity_grants].each do |equity_grant|
          equity_grant.update_columns(company_investor_entity_id: entity.id)
        end
      end
    end

    def determine_cap_table_notes(cap_table_notes)
      present_cap_table_notes = cap_table_notes.select(&:present?)

      if present_cap_table_notes.size == 1
        present_cap_table_notes.first
      else
        nil
      end
    end

    def initialize_entity_data(name)
      {
        name:,
        total_shares: 0,
        total_options: 0,
        investment_amount_cents: 0,
        cap_table_notes: Set.new,
        shareholdings: [],
        equity_grants: [],
        emails: Set.new,
      }
    end
end
