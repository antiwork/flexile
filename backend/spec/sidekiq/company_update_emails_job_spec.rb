# frozen_string_literal: true

require "spec_helper"

RSpec.describe CompanyUpdateEmailsJob, type: :job do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:company_update) { create(:company_update, company:) }
    let(:external_id) { company_update.external_id }

    context "when no specific recipients are provided" do
      let!(:active_contractor) { create(:company_worker, company:) }
      let!(:ended_contractor) { create(:company_worker, company:, ended_at: 1.day.ago) }
      let!(:investor) { create(:company_investor, company:) }

      it "sends emails to active contractors and investors" do
        expect(CompanyUpdateMailer).to receive(:update_published)
          .with(company_update_id: company_update.id, user_id: active_contractor.user.id)
          .and_return(double(deliver_now: true))

        expect(CompanyUpdateMailer).to receive(:update_published)
          .with(company_update_id: company_update.id, user_id: investor.user.id)
          .and_return(double(deliver_now: true))

        expect(CompanyUpdateMailer).not_to receive(:update_published)
          .with(company_update_id: company_update.id, user_id: ended_contractor.user.id)

        described_class.new.perform(external_id)
      end
    end

    context "when specific recipients are provided" do
      let!(:user1) { create(:user) }
      let!(:user2) { create(:user) }
      let(:recipient_user_ids) { [user1.id, user2.id] }

      it "sends emails only to specified recipients" do
        expect(CompanyUpdateMailer).to receive(:update_published)
          .with(company_update_id: company_update.id, user_id: user1.id)
          .and_return(double(deliver_now: true))

        expect(CompanyUpdateMailer).to receive(:update_published)
          .with(company_update_id: company_update.id, user_id: user2.id)
          .and_return(double(deliver_now: true))

        described_class.new.perform(external_id, recipient_user_ids)
      end
    end

    context "when company update does not exist" do
      let(:external_id) { "non-existent-id" }

      it "raises ActiveRecord::RecordNotFound" do
        expect do
          described_class.new.perform(external_id)
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when mailer raises an error" do
      let!(:contractor) { create(:company_worker, company:) }

      it "allows the error to bubble up for Sidekiq retry handling" do
        expect(CompanyUpdateMailer).to receive(:update_published)
          .and_raise(StandardError, "Email delivery failed")

        expect do
          described_class.new.perform(external_id)
        end.to raise_error(StandardError, "Email delivery failed")
      end
    end
  end
end
