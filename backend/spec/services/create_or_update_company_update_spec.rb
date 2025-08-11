# frozen_string_literal: true

RSpec.describe CreateOrUpdateCompanyUpdate do
  let(:company) { create(:company) }
  let(:company_update_params) do
    {
      title: "Update title",
      body: "Update body",
    }
  end

  before do
    allow(Time).to receive(:current).and_return(Time.zone.local(2023, 5, 15))
  end

  describe "#perform!" do
    subject(:result) { described_class.new(company:, company_update_params:).perform! }

    context "when creating a new company update" do
      it "creates a new company update with the correct attributes" do
        expect { result }.to change(company.company_updates, :count).by(1)
        expect(result[:success]).to be true
        expect(result[:company_update]).to eq(company.company_updates.last)

        company_update = result[:company_update]
        expect(company_update.body).to eq("Update body")
        expect(company_update.title).to eq("Update title")
      end
    end

    context "when updating an existing company update" do
      let!(:company_update) { create(:company_update, company:) }
      subject(:result) do
        described_class.new(company:, company_update_params:, company_update:).perform!
      end

      it "does not create a new company update" do
        expect { result }.not_to change(CompanyUpdate, :count)
      end

      it "updates the existing company update" do
        expect { result }.to change { company_update.reload.title }.to("Update title")
      end
    end

    context "when validation fails" do
      before { company_update_params[:title] = "" }

      it "raises an error" do
        expect { result }.to raise_error(ActiveRecord::RecordInvalid).with_message(/Title can't be blank/)
      end

      it "does not create a new company update" do
        expect { result }.to raise_error(ActiveRecord::RecordInvalid, /Title can't be blank/)
          .and not_change(CompanyUpdate, :count)
      end
    end
  end
end
