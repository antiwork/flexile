# frozen_string_literal: true

RSpec.describe PublishCompanyUpdate do
  let(:company) { create(:company) }
  let(:company_update) { create(:company_update, company:) }
  subject(:service) { described_class.new(company_update) }

  describe "#perform!" do
    context "when the update hasn't been sent" do
      let!(:active_company_worker) { create(:company_worker, company:) }
      let!(:inactive_company_worker) { create(:company_worker, company:, ended_at: 1.day.ago) }
      let!(:company_investor) { create(:company_investor, company:) }
      let!(:company_lawyer) { create(:company_lawyer, company:) }

      it "sets sent_at and returns success" do
        expect do
          result = service.perform!
          expect(result).to eq({ success: true, company_update: })
        end.to change { company_update.reload.sent_at }.from(nil)
      end

      it "enqueues email jobs for active contractors and investors" do
        expect do
          service.perform!
        end.to change { CompanyUpdateEmailJob.jobs.size }.by(2)

        expect(CompanyUpdateEmailJob).to have_enqueued_sidekiq_job(company_update.id, active_company_worker.user_id)
        expect(CompanyUpdateEmailJob).to have_enqueued_sidekiq_job(company_update.id, company_investor.user_id)
      end

      it "doesn't enqueue email jobs for inactive contractors or lawyers" do
        service.perform!

        expect(CompanyUpdateEmailJob).not_to have_enqueued_sidekiq_job(company_update.id, inactive_company_worker.user_id)
        expect(CompanyUpdateEmailJob).not_to have_enqueued_sidekiq_job(company_update.id, company_lawyer.user_id)
      end
    end

    context "when the update has already been sent" do
      let(:sent_at) { 1.day.ago.round }
      before { company_update.update!(sent_at:) }

      it "does nothing" do
        expect do
          result = service.perform!
          expect(result[:success]).to be true
          expect(result[:company_update]).to eq(company_update)
          expect(result[:company_update].sent_at).to eq(sent_at)
        end.not_to change { CompanyUpdateEmailJob.jobs.size }
      end
    end

    context "when there's an error updating the company update" do
      before do
        allow(company_update).to receive(:update!).and_raise(
          ActiveRecord::RecordInvalid.new(company_update.tap { _1.errors.add(:base, "Test error") })
        )
      end

      it "raises an error" do
        expect { service.perform! }.to raise_error(ActiveRecord::RecordInvalid).with_message(/Test error/)
      end

      it "doesn't enqueue any email jobs" do
        expect { service.perform! }.to raise_error(ActiveRecord::RecordInvalid, /Test error/)
          .and not_change { CompanyUpdateEmailJob.jobs.size }
      end
    end
  end
end
