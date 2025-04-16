# frozen_string_literal: true

class CompanyRolePresenter
  def self.actively_hiring_props(company:)
    {
      roles: company.company_roles.actively_hiring.map { { "id" => _1.external_id, "name" => _1.name } },
      company: {
        name: company.display_name,
        logo_url: company.logo_url,
        supports_equity: company.equity_compensation_enabled?,
      },
    }
  end

  def self.index_props(company:)
    if company.quickbooks_enabled? && company.reload.quickbooks_integration.present?
      expense_accounts = IntegrationApi::Quickbooks.new(company_id: company.id).get_expense_accounts
    end
    {
      expense_accounts:,
      roles: company.company_roles.includes(:company_workers).map do |role|
        contractors = role.company_workers.active.map do |contractor|
          { name: contractor.user.display_name, pay_rate_in_subunits: contractor.pay_rate_in_subunits }
        end
        {
          id: role.external_id,
          name: role.name,
          job_description: role.job_description,
          pay_rate_in_subunits: role.pay_rate_in_subunits,
          pay_rate_type: role.pay_rate_type,
          trial_enabled: role.trial_enabled?,
          trial_pay_rate_in_subunits: role.trial_pay_rate_in_subunits,
          actively_hiring: role.actively_hiring,
          applicant_count: role.company_role_applications.pending.count,
          capitalized_expense: role.capitalized_expense,
          can_delete: contractors.empty?,
          contractors:,
          expense_account_id: role.expense_account_id,
          expense_card_enabled: role.expense_card_enabled?,
          expense_card_spending_limit_cents: role.expense_card_spending_limit_cents,
          expense_cards_count: role.expense_cards.active.count,
        }
      end,
      company: {
        id: company.external_id,
        name: company.display_name,
        expense_cards_enabled: company.expense_cards_enabled?,
      },
    }
  end

  delegate :external_id, :name, :job_description, :pay_rate_in_subunits, :trial_pay_rate_in_subunits, :pay_rate_type, :trial_enabled?,
           :company, :actively_hiring, :expense_card_enabled, :expense_card_spending_limit_cents, private: true, to: :role

  def initialize(role)
    @role = role
  end

  def api_props
    {
      name:,
      job_description:,
      location: "Global",
      url: Rails.application.routes.url_helpers.spa_role_url(company.display_name.parameterize, role.name.parameterize, role.external_id),
      min_comp_usd: CompanyWorker::WORKING_WEEKS_PER_YEAR * 20 * pay_rate_in_subunits / 100.0,
      max_comp_usd: CompanyWorker::WORKING_WEEKS_PER_YEAR * 35 * pay_rate_in_subunits / 100.0,
      currency_code: "USD",
      period: "yearly",
      location_type: "Remote",
      employment_type: "Part-time",
    }
  end

  def props(ip_country:)
    result = {
      role: {
        name:,
        job_description:,
        pay_rate_in_subunits:,
        pay_rate_type:,
        trial_pay_rate_in_subunits: trial_enabled? ? trial_pay_rate_in_subunits : nil,
        actively_hiring:,
        expense_card_enabled:,
        expense_card_spending_limit_cents:,
      },
      company: {
        name: company.display_name,
        website: company.website,
        logo_url: company.logo_url,
        description: company.description || "",
        other_roles: company.company_roles.actively_hiring.where.not(id: role.id).map { { id: _1.external_id, name: _1.name } },
        max_equity_percentage: CompanyWorker::MAX_EQUITY_PERCENTAGE,
        share_price_usd: company.share_price_in_usd.to_f,
        exercise_price_usd: company.fmv_per_share_in_usd.to_f,
        equity_enabled: company.equity_compensation_enabled?,
        expense_cards_enabled: company.expense_cards_enabled?,
      },
      ip_country:,
    }
    result[:company][:stats] = company_stats if company.show_stats_in_job_descriptions?
    result
  end

  private
    attr_reader :role

    def company_stats
      Rails.cache.fetch("company_stats_#{company.id}", expires_in: 30.days) do
        now = Time.current
        avg_tenure = ApplicationRecord.connection.execute(
          <<~SQL
            WITH cte AS (
              SELECT
                #{CompanyWorker.arel_table.name}.id,
                EXTRACT(DAY FROM (COALESCE(#{CompanyWorker.arel_table.name}.ended_at, '#{now.to_fs(:db)}') - #{CompanyWorker.arel_table.name}.started_at)) AS avg_days,
                COUNT(invoices.id)
              FROM #{CompanyWorker.arel_table.name}
              JOIN users ON users.id = #{CompanyWorker.arel_table.name}.user_id
              JOIN invoices ON invoices.user_id = users.id AND invoices.status = '#{Invoice::PAID}'
              WHERE #{CompanyWorker.arel_table.name}.company_id = #{company.id}
              GROUP BY #{CompanyWorker.arel_table.name}.id
              HAVING COUNT(invoices.id) > 2
            )
            SELECT AVG(avg_days) / 365 AS avg FROM cte
          SQL
        ).to_a.flatten.first["avg"]&.to_f || 0

        avg_weeks_per_month = ApplicationRecord.connection.execute(
          <<~SQL
            WITH cte AS (
              SELECT
                (SUM(total_minutes / 60) / COUNT(invoices.id)) / hours_per_week AS avg_contractor_weeks_per_invoice,
                COUNT(invoices.id)
              FROM invoices
              JOIN users ON users.id = invoices.user_id
              JOIN #{CompanyWorker.arel_table.name} ON #{CompanyWorker.arel_table.name}.user_id = users.id
              WHERE #{CompanyWorker.arel_table.name}.company_id = #{company.id}
              AND #{CompanyWorker.arel_table.name}.ended_at IS NULL
              AND #{CompanyWorker.arel_table.name}.pay_rate_type = #{CompanyWorker.pay_rate_types[:hourly]}
              AND invoices.created_at >= '#{(now - 365.days).to_fs(:db)}'
              GROUP BY #{CompanyWorker.arel_table.name}.id
              HAVING COUNT(invoices.id) > 2
            )
            SELECT AVG(avg_contractor_weeks_per_invoice) AS avg FROM cte
          SQL
        ).to_a.flatten.first["avg"]&.to_f || 0

        avg_hours_per_week = ApplicationRecord.connection.execute(
          <<~SQL
            WITH cte AS (
              SELECT
                (SUM(total_minutes / 60) / COUNT(invoices.id)) / 4 AS avg_contractor_hours_per_week,
                COUNT(invoices.id)
              FROM invoices
              JOIN users ON users.id = invoices.user_id
              JOIN #{CompanyWorker.arel_table.name} ON #{CompanyWorker.arel_table.name}.user_id = users.id
              WHERE #{CompanyWorker.arel_table.name}.company_id = #{company.id}
              AND #{CompanyWorker.arel_table.name}.ended_at IS NULL
              AND #{CompanyWorker.arel_table.name}.pay_rate_type = #{CompanyWorker.pay_rate_types[:hourly]}
              AND invoices.created_at >= '#{(now - 365.days).to_fs(:db)}'
              GROUP BY #{CompanyWorker.arel_table.name}.id
              HAVING COUNT(invoices.id) > 2
            )
            SELECT AVG(avg_contractor_hours_per_week) AS avg FROM cte
          SQL
        ).to_a.flatten.first["avg"]&.to_f || 0

        {
          freelancers: company.company_workers.active.count,
          avg_weeks_per_year: avg_weeks_per_month * 12,
          avg_hours_per_week:,
          avg_tenure:,
          attrition_rate: 1,
        }
      end
    end
end
