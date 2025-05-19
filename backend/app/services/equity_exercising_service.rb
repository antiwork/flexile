# frozen_string_literal: true

class EquityExercisingService
  def initialize(exercise)
    @exercise = exercise
    @company_investor = exercise.company_investor
    @company = @company_investor.company
    @equity_grants = exercise.equity_grants
  end

  def self.create_request(equity_grants_params:, submission_id:, company_investor:, company_worker:)
    company = company_investor.company
    number_of_options_by_equity_grant = equity_grants_params.to_h { [_1[:id], _1[:number_of_options]] }
    equity_grant_ids = number_of_options_by_equity_grant.keys

    equity_grants = company_investor.equity_grants.where(external_id: equity_grant_ids)

    exercise = nil
    ApplicationRecord.transaction do
      current_time = Time.current
      equity_grants.lock!
      equity_grant_names = equity_grants.map(&:name).to_sentence
      if equity_grants.any?(&:active_exercise_id?)
        return { success: false, error: "Please wait for one exercise to complete before starting another" }
      end
      if equity_grants.any? { |equity_grant| equity_grant.expires_at <= current_time }
        return { success: false, error: "Cannot exercise expired equity grants" }
      end

      total_number_of_options = 0
      total_cost_cents = 0

      equity_grants.each do |equity_grant|
        number_of_options = number_of_options_by_equity_grant[equity_grant.external_id]
        cost_price_cents = (equity_grant.exercise_price_usd * number_of_options * 100).round

        total_number_of_options += number_of_options
        total_cost_cents += cost_price_cents
      end
      exercise = company_investor.equity_grant_exercises.create!(
        requested_at: current_time,
        total_cost_cents:,
        number_of_options: total_number_of_options,
        status: EquityGrantExercise::SIGNED,
        bank_reference: equity_grant_names,
        bank_account: company.equity_exercise_bank_account,
        signed_at: current_time,
      )

      equity_grants.update!(active_exercise_id: exercise.id)
      equity_grants.each do |equity_grant|
        equity_grant.equity_grant_exercise_requests.create!(
          equity_grant:,
          equity_grant_exercise: exercise,
          number_of_options: number_of_options_by_equity_grant[equity_grant.external_id],
          exercise_price_usd: equity_grant.exercise_price_usd
        )
      end
      document = Document.new(company:, name: "Notice of Exercise", document_type: :exercise_notice, year: current_time.year,
                              json_data: { equity_grant_exercise_id: exercise.id }, docuseal_submission_id: submission_id)
      document.signatures.build(user: company_investor.user, title: "Signer", signed_at: current_time)
      document.save!
      CompanyInvestorMailer.stock_exercise_payment_instructions(company_investor.id, exercise_id: exercise.id).deliver_later
      if company.completed_onboarding?
        company.company_administrators.ids.each do
          CompanyMailer.confirm_option_exercise_payment(admin_id: _1, exercise_id: exercise.id).deliver_later
        end
      end
    rescue ActiveRecord::RecordInvalid => e
      return { success: false, error: e.record.errors.full_messages.to_sentence }
    end

    { success: true, exercise: }
  end

  def process
    begin
      ApplicationRecord.transaction do
        exercise.lock!
        equity_grants.lock!

        if exercise.status != EquityGrantExercise::SIGNED
          return { success: false, error: "Exercise is not in signed state" }
        end

        exercise.equity_grant_exercise_requests.includes(:equity_grant).each do |equity_grant_exercise_request|
          equity_grant = equity_grant_exercise_request.equity_grant
          equity_grant.update!(
            vested_shares: equity_grant.vested_shares - equity_grant_exercise_request.number_of_options,
            exercised_shares: equity_grant.exercised_shares + equity_grant_exercise_request.number_of_options,
            active_exercise_id: nil
          )
          share_holding = create_share_holding(equity_grant_exercise_request:)
          share_holding.company_investor_entity.increment!(:investment_amount_cents, share_holding.total_amount_in_cents)
        end
        company_investor.increment!(:investment_amount_in_cents, exercise.total_cost_cents)
        exercise.update!(status: EquityGrantExercise::COMPLETED)
        exercise.equity_grant_exercise_requests.pluck(:share_holding_id).each do |share_holding_id|
          CompanyInvestorMailer.stock_exercise_success(company_investor.id, share_holding_id:).deliver_later
        end
      end
    rescue => e
      return { success: false, error: e.record.errors.full_messages.to_sentence || "Something went wrong" }
    end

    { success: true }
  end

  private
    attr_reader :exercise, :equity_grants, :company_investor, :company

    def create_share_holding(equity_grant_exercise_request:)
      share_holding = company_investor.share_holdings.create!(
        company_investor_entity_id: equity_grant_exercise_request.equity_grant.company_investor_entity_id,
        equity_grant_id: equity_grant_exercise_request.equity_grant_id,
        share_holder_name: equity_grant_exercise_request.equity_grant.option_holder_name,
        name: next_share_name,
        issued_at: exercise.requested_at,
        originally_acquired_at: exercise.requested_at,
        number_of_shares: equity_grant_exercise_request.number_of_options,
        share_price_usd: equity_grant_exercise_request.exercise_price_usd,
        total_amount_in_cents: equity_grant_exercise_request.total_cost_cents,
        share_class_id: equity_grant_exercise_request.equity_grant.option_pool.share_class_id
      )
      equity_grant_exercise_request.update!(share_holding:)
      share_holding
    end

    def next_share_name
      preceding_share = company.share_holdings.order(id: :desc).first
      return "#{company.name.first(1).upcase}-1" if preceding_share.nil?

      preceding_share_digits = preceding_share.name.scan(/\d+\z/).last
      preceding_share_number = preceding_share_digits.to_i

      next_share_number = preceding_share_number + 1
      preceding_share.name.reverse.sub(preceding_share_digits.reverse, next_share_number.to_s.reverse).reverse
    end
end
