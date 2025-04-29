# frozen_string_literal: true

class UpdateCompanyRoleService
  def initialize(role:, params:, rate_params:)
    @role = role
    @params = params
    @rate_params = rate_params
  end

  def process
    error = nil

    ActiveRecord::Base.transaction do
      update_all_rates = params.delete(:update_all_rates)
      contractors_to_update = role.company_workers
      contractors_to_update = contractors_to_update.where(pay_rate_in_subunits: role.pay_rate_in_subunits) unless update_all_rates

      role.rate.pay_rate_in_subunits = rate_params[:pay_rate_in_subunits]
      role.rate.pay_rate_currency = role.company.default_currency
      role.assign_attributes(params)
      expense_card_enabled_changed = role.expense_card_enabled_changed?
      expense_cards_changed = expense_card_enabled_changed || role.expense_card_spending_limit_cents_changed?

      role.save!
      contractors_to_update.update!(pay_rate_in_subunits: role.pay_rate_in_subunits)
      if expense_cards_changed
        # TODO: @raphaelcosta handle transaction when update is not successful https://github.com/antiwork/flexile/pull/2465#discussion_r1696884281
        expense_result = Stripe::ExpenseCardsUpdateService.new(role:).process

        unless expense_result[:success]
          error = expense_result[:error]
          raise ActiveRecord::Rollback
        end
      end

      if expense_card_enabled_changed && role.expense_card_enabled
        contractor_ids_granted = role.company_workers.active.pluck(:id)
        ExpenseCardGrantEmailJob.perform_bulk(contractor_ids_granted.zip)
      end
    end

    { success: error.nil?, error: }
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error: e.message }
  end

  private
    attr_reader :role, :params, :rate_params
end
