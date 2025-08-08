# frozen_string_literal: true

RSpec.describe EquityExercisingService do
  let!(:company) { create(:company, :completed_onboarding, name: "Gumroad") }
  let(:user) { create(:user) }
  let(:company_investor) { create(:company_investor, company:, user:) }
  let!(:company_worker) { create(:company_worker, company:, user:) }
  let!(:company_administrator) { company_worker.company.primary_admin }
  let(:company_investor_entity) { create(:company_investor_entity, company:, name: user.legal_name, email: user.email) }
  let(:equity_grant) do
    create(:equity_grant, company_investor:, company_investor_entity:, number_of_shares: 1000,
                          vested_shares: 400, unvested_shares: 350,
                          exercised_shares: 250, exercise_price_usd: 10)
  end
  let(:share_class) { equity_grant.option_pool.share_class }
  let!(:equity_exercise_bank_account) { create(:equity_exercise_bank_account, company:) }

  describe ".create_request" do
    let(:equity_grants_params) do
      [
        { id: equity_grant.external_id, number_of_options: 100 },
      ]
    end
    subject(:create_exercise_request) { described_class.create_request(equity_grants_params:, company_investor:, company_worker:, submission_id: "submission") }

    it "disallows creating a request when an exercise is in progress for the equity grant" do
      active_exercise = create(:equity_grant_exercise, :signed, equity_grants: [equity_grant])
      equity_grant.update!(active_exercise:)

      expect do
        expect(create_exercise_request).to eq({ success: false, error: "Please wait for one exercise to complete before starting another" })
      end.not_to change(EquityGrantExercise, :count)
    end

    it "disallows creating a request when the equity grant is expired" do
      equity_grant.update!(expires_at: Time.current)

      expect do
        expect(create_exercise_request).to eq({ success: false, error: "Cannot exercise expired equity grants" })
      end.not_to change(EquityGrantExercise, :count)
    end

    context "when number of options is 0" do
      let(:equity_grants_params) do
        [
          { id: equity_grant.external_id, number_of_options: 0 },
        ]
      end

      it "returns an error response when the exercise record is not saved" do
        expect do
          expect(create_exercise_request).to eq({
            success: false,
            error: "Number of options must be greater than or equal to 1 and Total cost cents must be greater than or equal to 1",
          })
        end.not_to change(EquityGrantExercise, :count)
      end
    end

    it "creates the exercise as expected for US residents" do
      exercise = nil
      expect do
        result = create_exercise_request
        expect(result.keys).to eq([:success, :exercise])
        expect(result[:success]).to eq(true)
        exercise = result[:exercise]
        expect(exercise).to be_an_instance_of(EquityGrantExercise)
      end.to change(EquityGrantExercise, :count).by(1)
                     .and have_enqueued_mail(CompanyMailer, :confirm_option_exercise_payment).with(admin_id: company_administrator.id, exercise_id: anything) { |arg| expect(arg[:exercise_id]).to eq(exercise.id) }
                                                                                             .and have_enqueued_mail(CompanyInvestorMailer, :stock_exercise_payment_instructions).with(company_investor.id, exercise_id: anything) { |_, arg| expect(arg[:exercise_id]).to eq(exercise.id) }
                                                                                                                                                                                 .and change { Document.count }.by(1)

      expect(exercise.requested_at).to be_present
      expect(exercise.number_of_options).to eq(100)
      expect(exercise.total_cost_cents).to eq((equity_grant.exercise_price_usd * 100 * 100).round)
      expect(exercise.status).to eq(EquityGrantExercise::SIGNED)
      expect(exercise.bank_reference).to eq(equity_grant.name)

      expect(exercise.signed_at).to be_present
      expect(exercise.bank_account).to eq(equity_exercise_bank_account)

      document = Document.last
      expect(document.year).to eq(exercise.signed_at.year)
      expect(document.company).to eq(company)
      expect(document.name).to eq("Notice of Exercise")
      expect(document.json_data).to eq({ equity_grant_exercise_id: exercise.id }.as_json)
      expect(document.signatures.count).to eq(1)

      user_signature = document.signatures.find_by(user:)
      expect(user_signature.title).to eq("Signer")
      expect(user_signature.signed_at).to be_present
    end

    it "creates the exercise as expected for non-US residents" do
      company_investor.user.update!(country_code: "UY")

      exercise = nil
      expect do
        result = create_exercise_request
        expect(result.keys).to eq([:success, :exercise])
        expect(result[:success]).to eq(true)
        exercise = result[:exercise]
        expect(exercise).to be_an_instance_of(EquityGrantExercise)
      end.to change(EquityGrantExercise, :count).by(1)

      expect(exercise.requested_at).to be_present
      expect(exercise.number_of_options).to eq(100)
      expect(exercise.total_cost_cents).to eq((equity_grant.exercise_price_usd * 100 * 100).round)
      expect(exercise.status).to eq(EquityGrantExercise::SIGNED)
      expect(exercise.bank_reference).to eq(equity_grant.name)
    end
  end

  describe "#process" do
    let!(:exercise) do
      create(:equity_grant_exercise, :signed, company:, company_investor:, equity_grants: [equity_grant],
                                              number_of_options: 400, total_cost_cents: 4000_00)
    end

    it "returns early if the exercise record is not in the signed state" do
      status = (EquityGrantExercise::ALL_STATUSES - [EquityGrantExercise::SIGNED]).sample
      exercise.update_columns(status:)

      expect do
        result = EquityExercisingService.new(exercise).process
        expect(result).to eq({ success: false, error: "Exercise is not in signed state" })
      end.to change { ShareHolding.count }.by(0)
         .and change { exercise.equity_grants.first.reload.updated_at }.by(0)
         .and change { company_investor.reload.investment_amount_in_cents }.by(0)
    end

    it "returns the error message if an error occurs when updating the grant record" do
      equity_grant.update!(vested_shares: 0, unvested_shares: 750)

      expect do
        result = EquityExercisingService.new(exercise).process
        expect(result).to eq({ success: false, error: "Vested shares must be greater than or equal to 0" })
      end.to change { ShareHolding.count }.by(0)
         .and change { exercise.equity_grants.first.reload.updated_at }.by(0)
         .and change { company_investor.reload.investment_amount_in_cents }.by(0)
    end

    it "returns the error message if an error occurs when creating the share record" do
      allow_any_instance_of(ShareHolding).to receive(:save!) do |instance|
        instance.errors.add(:base, "I was meant to error!")
        raise ActiveRecord::RecordInvalid.new(instance)
      end

      expect do
        result = EquityExercisingService.new(exercise).process
        expect(result).to eq({ success: false, error: "I was meant to error!" })
      end.to change { ShareHolding.count }.by(0)
         .and change { exercise.equity_grants.first.reload.updated_at }.by(0)
         .and change { exercise.company_investor.reload.investment_amount_in_cents }.by(0)
    end

    it "creates and updates records on success and queues an email" do
      expect do
        result = EquityExercisingService.new(exercise).process
        expect(result).to eq({ success: true })
      end.to change { ShareHolding.count }.by(1)
         .and change { company_investor.reload.investment_amount_in_cents }.by(exercise.total_cost_cents)
         .and change { company_investor_entity.reload.investment_amount_cents }.by(exercise.total_cost_cents)
         .and have_enqueued_mail(CompanyInvestorMailer, :stock_exercise_success).with(company_investor.id, share_holding_id: kind_of(Integer))

      share_holding = ShareHolding.last
      exercise_request = exercise.equity_grant_exercise_requests.first
      expect(share_holding.equity_grant_id).to eq(equity_grant.id)
      expect(share_holding.company_investor).to eq(equity_grant.company_investor)
      expect(share_holding.company_investor_entity).to eq(equity_grant.company_investor_entity)
      expect(share_holding.share_holder_name).to eq(equity_grant.option_holder_name)
      expect(share_holding.name).to eq("#{company.name.first(1)}-1")
      expect(share_holding.issued_at).to eq(exercise.requested_at)
      expect(share_holding.originally_acquired_at).to eq(exercise.requested_at)
      expect(share_holding.number_of_shares).to eq(exercise_request.number_of_options)
      expect(share_holding.share_price_usd).to eq(exercise_request.exercise_price_usd)
      expect(share_holding.total_amount_in_cents).to eq(exercise_request.total_cost_cents)
      expect(share_holding.share_class).to eq(share_class)

      equity_grant.reload
      expect(equity_grant.vested_shares).to eq(0)
      expect(equity_grant.exercised_shares).to eq(650) # 400 from the exercise + 250 already exercised

      exercise.reload
      expect(exercise.status).to eq(EquityGrantExercise::COMPLETED)

      equity_grant_exercise_request = exercise.equity_grant_exercise_requests.find_by(equity_grant:)
      expect(equity_grant_exercise_request.share_holding_id).to eq(share_holding.id)
    end

    it "uses the next share name if there are existing share records" do
      create(:share_holding, company_investor:, share_class:, name: "A-1")

      expect do
        result = EquityExercisingService.new(exercise).process
        expect(result).to eq({ success: true })
      end.to change { ShareHolding.count }.by(1)

      share_holding = ShareHolding.last
      expect(share_holding.name).to eq("A-2")
    end

    context "when the exercise is for multiple equity grants" do
      let(:equity_grant_2) do
        create(:equity_grant, company_investor:, number_of_shares: 1000,
                              vested_shares: 200, unvested_shares: 500,
                              exercised_shares: 300, exercise_price_usd: 10)
      end
      let(:exercise) do
        create(:equity_grant_exercise, :signed, company:,
                                                company_investor:,
                                                equity_grants: [equity_grant, equity_grant_2],
                                                number_of_options: 600, total_cost_cents: 6000_00)
      end

      it "creates and updates records on success and queues an email" do
        expect do
          result = EquityExercisingService.new(exercise).process
          expect(result).to eq({ success: true })
        end.to change { ShareHolding.count }.by(2)
           .and change { company_investor.reload.investment_amount_in_cents }.by(exercise.total_cost_cents)

        share_holding_1 = ShareHolding.find_by(equity_grant: equity_grant)
        share_holding_2 = ShareHolding.find_by(equity_grant: equity_grant_2)
        expect(share_holding_1.name).to eq("#{company.name.first(1)}-1")
        expect(share_holding_2.name).to eq("#{company.name.first(1)}-2")
        expect(share_holding_1.number_of_shares).to eq(400)
        expect(share_holding_2.number_of_shares).to eq(200)
        expect(share_holding_1.total_amount_in_cents).to eq(4000_00)
        expect(share_holding_2.total_amount_in_cents).to eq(2000_00)
        expect(share_holding_1.share_price_usd).to eq(equity_grant.exercise_price_usd)
        expect(share_holding_2.share_price_usd).to eq(equity_grant_2.exercise_price_usd)

        equity_grant.reload
        expect(equity_grant.vested_shares).to eq(0)
        expect(equity_grant.exercised_shares).to eq(650) # 400 from the exercise + 250 already exercised
        expect(equity_grant.active_exercise_id).to be_nil

        equity_grant_2.reload
        expect(equity_grant_2.vested_shares).to eq(0)
        expect(equity_grant_2.exercised_shares).to eq(500) # 200 from the exercise + 300 already exercised
        expect(equity_grant_2.active_exercise_id).to be_nil

        exercise.reload
        expect(exercise.status).to eq(EquityGrantExercise::COMPLETED)

        equity_grant_exercise_request_1 = exercise.equity_grant_exercise_requests.find_by(equity_grant:)
        equity_grant_exercise_request_2 = exercise.equity_grant_exercise_requests.find_by(equity_grant: equity_grant_2)
        expect(equity_grant_exercise_request_1.share_holding_id).to eq(share_holding_1.id)
        expect(equity_grant_exercise_request_2.share_holding_id).to eq(share_holding_2.id)
      end
    end
  end
end
