# frozen_string_literal: true

RSpec.describe CompleteInviteLinkOnboarding do
  let(:company) { create(:company) }
  let(:user) { create(:user) }
  let(:company_worker) { create(:company_worker, user: user, company: company) }
  let(:invite_link) { create(:company_invite_link, company: company) }

  before do
    user.update!(signup_invite_link: invite_link)
  end

  describe "#process" do
    let(:update_params) { { role: "Software Engineer" } }

    context "when company_worker does not exist" do
      it "returns failure" do
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(false)
        expect(result[:error]).to match(/Company worker not found/)
      end
    end

    context "when update fails" do
      before { company_worker }
      it "returns failure" do
        allow_any_instance_of(CompanyWorker).to receive(:update).with(any_args).and_return(false)
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(false)
        expect(result[:error]).to be_present
      end
    end

    context "when contract_signed_elsewhere is true" do
      before { company_worker.update!(contract_signed_elsewhere: true) }
      it "returns success" do
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(true)
        expect(result[:company_worker]).to eq(company_worker)
      end
    end

    context "when invite_link is not found" do
      before do
        user.update!(signup_invite_link: nil)
        company_worker.update!(contract_signed_elsewhere: false)
      end

      it "returns success if signup_invite_link is nil" do
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(true)
        expect(result[:company_worker]).to eq(company_worker)
      end
    end

    context "when contract creation fails" do
      before { company_worker.update!(contract_signed_elsewhere: false) }
      it "returns failure" do
        allow_any_instance_of(CompanyWorker).to receive(:update).with(any_args).and_return(true)
        allow_any_instance_of(CreateConsultingContract).to receive(:perform!).and_raise(StandardError, "fail")
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(false)
        expect(result[:error]).to match(/Contract creation failed/)
      end
    end

    context "when contract is created" do
      before { company_worker.update!(contract_signed_elsewhere: false) }
      it "returns success with document and template_id" do
        fake_doc = double("Document", id: 123)
        allow_any_instance_of(CompanyWorker).to receive(:update).with(any_args).and_return(true)
        allow(CreateConsultingContract).to receive(:new).and_return(double(perform!: fake_doc))
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(true)
        expect(result[:document]).to eq(fake_doc)
        expect(result[:template_id]).to eq(invite_link.document_template_id)
      end
    end

    context "when invite_link id is present but invite_link does not exist" do
      before do
        user.update!(signup_invite_link_id: 999_999) # non-existent id
        company_worker.update!(contract_signed_elsewhere: false)
      end

      it "returns failure" do
        result = described_class.new(user: user, company: company, update_params: update_params).process
        expect(result[:success]).to eq(false)
        expect(result[:error]).to match(/Invite link not found/)
      end
    end
  end
end
