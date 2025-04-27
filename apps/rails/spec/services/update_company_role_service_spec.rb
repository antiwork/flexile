# frozen_string_literal: true

RSpec.describe UpdateCompanyRoleService do
  let(:company) { create(:company) }
  let(:company_role) { create(:company_role, company: company) }
  let(:params) do
    {
      name: "Updated Role",
      job_description: "Updated job description",
      capitalized_expense: 30,
    }
  end
  let(:rate_params) do
    {
      pay_rate_in_subunits: 15000,
    }
  end

  subject(:process_service) { described_class.new(role: company_role, params: params, rate_params: rate_params).process }

  describe "#process" do
    context "when update is successful" do
      it "updates the role and its rate" do
        expect(process_service[:success]).to be true
        expect(company_role.reload.attributes).to include(
          "name" => "Updated Role",
          "job_description" => "Updated job description",
          "capitalized_expense" => 30,
        )
        expect(company_role.rate.pay_rate_in_subunits).to eq 15000
      end

      it "updates rates for contractors with the same rate only unless update_all_rates is true" do
        contractor = create(:company_worker, company: company, company_role: company_role, pay_rate_in_subunits: company_role.pay_rate_in_subunits)
        custom_contractor = create(:company_worker, company: company, company_role: company_role, pay_rate_in_subunits: 5000)

        process_service
        expect(contractor.reload.pay_rate_in_subunits).to eq 15000
        expect(custom_contractor.reload.pay_rate_in_subunits).to eq 5000

        params[:update_all_rates] = true
        described_class.new(role: company_role, params: params, rate_params: rate_params).process
        expect(contractor.reload.pay_rate_in_subunits).to eq 15000
        expect(custom_contractor.reload.pay_rate_in_subunits).to eq 15000
      end
    end

    context "when updating expense cards" do
      let!(:company_workers) { create_list(:company_worker, 3, company:, company_role:) }
      let!(:inactive_contractor) { create(:company_worker, company:, company_role:, ended_at: 1.day.ago) }

      before do
        company_role.update!(expense_card_enabled: false, expense_card_spending_limit_cents: 0)
        params[:expense_card_enabled] = true
        params[:expense_card_spending_limit_cents] = 500_00
      end

      it "updates the role and its expense cards" do
        issuing_service = instance_double(Stripe::ExpenseCardsUpdateService, process: { success: true })
        expect(Stripe::ExpenseCardsUpdateService).to receive(:new).with(role: company_role).and_return(issuing_service)

        expect(process_service[:success]).to be true
        expect(company_role.reload.expense_card_enabled).to be true
        expect(company_role.expense_card_spending_limit_cents).to eq 500_00
      end


      it "sends grant emails to contractors" do
        expect do
          process_service
        end.to change { ExpenseCardGrantEmailJob.jobs.size }.by(3)

        company_workers.each do |company_worker|
          expect(ExpenseCardGrantEmailJob).to have_enqueued_sidekiq_job(company_worker.id)
        end
        expect(ExpenseCardGrantEmailJob).not_to have_enqueued_sidekiq_job(inactive_contractor.id)
      end

      context "when Stripe::ExpenseCardsUpdateService fails" do
        it "raises an error and does not update the role" do
          issuing_service = instance_double(Stripe::ExpenseCardsUpdateService, process: { success: false, error: "Update on Stripe failed" })
          expect(Stripe::ExpenseCardsUpdateService).to receive(:new).with(role: company_role).and_return(issuing_service)

          expect do
            process_service
          end.not_to change { ExpenseCardGrantEmailJob.jobs.size }

          expect(process_service[:success]).to be false
          expect(process_service[:error]).to eq "Update on Stripe failed"
          expect(company_role.reload.expense_card_enabled).to be false
          expect(company_role.expense_card_spending_limit_cents).to eq 0
        end
      end

      context "when disabling expense cards" do
        before do
          company_role.update!(expense_card_enabled: true)
          params[:expense_card_enabled] = false
        end

        it "does not send grant emails" do
          expect do
            process_service
          end.not_to change { ExpenseCardGrantEmailJob.jobs.size }

          expect(company_role.reload.expense_card_enabled).to be false
        end
      end
    end

    context "when update fails" do
      before do
        company_role.errors.add(:base, "Update failed")
        allow(company_role).to receive(:save!).and_raise(ActiveRecord::RecordInvalid, company_role)
      end

      it "returns an error message" do
        expect do
          process_service
        end.not_to change { ExpenseCardGrantEmailJob.jobs.size }

        expect(process_service[:success]).to be false
        expect(process_service[:error]).to eq "Validation failed: Update failed"
      end
    end
  end
end
