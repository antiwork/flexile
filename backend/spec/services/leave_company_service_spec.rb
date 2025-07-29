# frozen_string_literal: true

RSpec.describe LeaveCompanyService do
  let(:company) { create(:company) }
  let(:user) { create(:user) }
  let(:service) { described_class.new(user: user, company: company) }

  describe "#call" do
    context "when user is an administrator" do
      before do
        create(:company_administrator, user: user, company: company)
      end

      it "returns failure with appropriate error message" do
        result = service.call

        expect(result[:success]).to be false
        expect(result[:error]).to eq "Administrators cannot leave a company."
      end

      it "does not remove any user roles" do
        create(:company_worker, user: user, company: company)
        create(:company_investor, user: user, company: company)

        expect { service.call }.not_to change { user.company_workers.count }
        expect { service.call }.not_to change { user.company_investors.count }
      end
    end

    context "when user has no roles in the company" do
      it "returns failure with appropriate error message" do
        result = service.call

        expect(result[:success]).to be false
        expect(result[:error]).to eq "You do not have permission to leave this company."
      end
    end

    context "when user already left the company" do
      let!(:company_worker) { create(:company_worker, user: user, company: company, ended_at: 1.day.ago) }

      it "returns failure with appropriate error message" do
        result = service.call

        expect(result[:success]).to be false
        expect(result[:error]).to eq "You do not have permission to leave this company."
      end
    end

    context "when user is a contractor" do
      let!(:company_worker) { create(:company_worker, user: user, company: company) }

      it "returns success" do
        result = service.call

        expect(result[:success]).to be true
        expect(result[:error]).to be_nil
      end

      it "ends the contractor contract" do
        expect { service.call }.to change { user.company_workers.where(company: company).first&.ended_at }.from(nil)
        expect(user.company_workers.where(company: company).first.ended_at).to be_present
      end
    end

    context "when user is an investor" do
      let!(:company_investor) { create(:company_investor, user: user, company: company) }

      it "returns success" do
        result = service.call

        expect(result[:success]).to be true
        expect(result[:error]).to be_nil
      end

      it "removes the investor role" do
        expect { service.call }.to change { user.company_investors.count }.by(-1)
      end
    end

    context "when user is a lawyer" do
      let!(:company_lawyer) { create(:company_lawyer, user: user, company: company) }

      it "returns success" do
        result = service.call

        expect(result[:success]).to be true
        expect(result[:error]).to be_nil
      end

      it "removes the lawyer role" do
        expect { service.call }.to change { user.company_lawyers.count }.by(-1)
      end
    end

    context "when user has multiple roles" do
      let!(:company_worker) { create(:company_worker, user: user, company: company) }
      let!(:company_investor) { create(:company_investor, user: user, company: company) }
      let!(:company_lawyer) { create(:company_lawyer, user: user, company: company) }

      it "returns success" do
        result = service.call

        expect(result[:success]).to be true
        expect(result[:error]).to be_nil
      end

      it "removes all user roles" do
        expect { service.call }.to change { user.company_investors.count }.by(-1)
          .and change { user.company_lawyers.count }.by(-1)

        # Worker should have ended_at set instead of being deleted
        worker = user.company_workers.where(company: company).first
        expect(worker.ended_at).to be_present
      end
    end

    context "when user has roles in multiple companies" do
      let(:other_company) { create(:company) }
      let!(:company_worker) { create(:company_worker, user: user, company: company) }
      let!(:other_company_worker) { create(:company_worker, user: user, company: other_company) }

      it "only removes roles for the specified company" do
        result = service.call

        expect(result[:success]).to be true

        # Worker for this company should have ended_at set
        company_worker = user.company_workers.where(company: company).first
        expect(company_worker.ended_at).to be_present

        # Worker for other company should remain active
        other_worker = user.company_workers.where(company: other_company).first
        expect(other_worker.ended_at).to be_nil
      end
    end

    context "when user is both administrator and has other roles" do
      let!(:company_administrator) { create(:company_administrator, user: user, company: company) }
      let!(:company_worker) { create(:company_worker, user: user, company: company) }

      it "returns failure due to administrator status" do
        result = service.call

        expect(result[:success]).to be false
        expect(result[:error]).to eq "Administrators cannot leave a company."
      end

      it "does not remove any roles" do
        expect { service.call }.not_to change { user.company_workers.count }
      end
    end

    context "when database operation fails" do
      let!(:company_worker) { create(:company_worker, user: user, company: company) }

      before do
        allow(user.company_workers).to receive(:where).and_raise(ActiveRecord::ActiveRecordError, "Database error")
      end

      it "returns failure with error message" do
        result = service.call

        expect(result[:success]).to be false
        expect(result[:error]).to eq "Database error"
      end
    end

    context "transaction rollback behavior" do
      let!(:company_worker) { create(:company_worker, user: user, company: company) }
      let!(:company_investor) { create(:company_investor, user: user, company: company) }

      before do
        allow(user.company_lawyers).to receive(:where).and_raise(ActiveRecord::ActiveRecordError, "Simulated error")
      end

      it "rolls back all changes on error" do
        initial_worker_count = user.company_workers.count
        initial_investor_count = user.company_investors.count

        service.call

        expect(user.company_workers.count).to eq initial_worker_count
        expect(user.company_investors.count).to eq initial_investor_count
      end
    end
  end

  describe "#user_is_administrator?" do
    context "when user is an administrator" do
      before do
        create(:company_administrator, user: user, company: company)
      end

      it "returns true" do
        expect(service.send(:user_is_administrator?)).to be true
      end
    end

    context "when user is not an administrator" do
      it "returns false" do
        expect(service.send(:user_is_administrator?)).to be false
      end
    end
  end

  describe "user_has_leavable_role?" do
    context "when user is a contractor" do
      before do
        create(:company_worker, user: user, company: company)
      end

      it "returns true" do
        expect(service.send(:user_has_leavable_role?)).to be true
      end
    end

    context "when user is an investor" do
      before do
        create(:company_investor, user: user, company: company)
      end

      it "returns true" do
        expect(service.send(:user_has_leavable_role?)).to be true
      end
    end

    context "when user is a lawyer" do
      before do
        create(:company_lawyer, user: user, company: company)
      end

      it "returns true" do
        expect(service.send(:user_has_leavable_role?)).to be true
      end
    end

    context "when user has no leavable roles" do
      it "returns false" do
        expect(service.send(:user_has_leavable_role?)).to be false
      end
    end
  end
end
