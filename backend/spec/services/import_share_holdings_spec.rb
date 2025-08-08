# frozen_string_literal: true

RSpec.describe ImportShareHoldings do
  let(:user_mapping_csv) do
    <<~CSV
      Name,Email
      John Doe,sharang.d+1@gmail.com
      Jane Smith,sharang.d+2@gmail.com
    CSV
  end

  let(:share_data_csv) do
    <<~CSV
      Security,Holder,Shares,Price,Total,Issue Date,Share Class
      Common Stock,John Doe,1000,$1.00,1000.00,2024-01-01,Common
      Preferred Stock,Jane Smith,500,$2.00,1000.00,2024-01-15,Preferred
    CSV
  end

  describe "Environment is in an unexpected state" do
    it "raises an exception if user mapping CSV is malformed" do
      create(:company, id: 5)

      expect do
        described_class.new(user_mapping_csv: "invalid,csv", share_data_csv: share_data_csv).process
      end.to change(ShareHolding, :count).by(0)
    end

    it "raises an exception if the CSV has an unknown email" do
      expect do
        described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv).process
      end.to raise_error(ActiveRecord::RecordNotFound)
               .and change(ShareHolding, :count).by(0)
    end

    it "raises an exception if there is no Gumroad company" do
      expect do
        described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv).process
      end.to raise_error(ActiveRecord::RecordNotFound)
               .and change(ShareHolding, :count).by(0)
    end

    it "raises an exception if there are multiple Gumroad-like companies" do
      create_pair(:company)

      expect do
        described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv).process
      end.to raise_error(ActiveRecord::RecordNotFound)
               .and change(ShareHolding, :count).by(0)
    end
  end

  describe "Happy path" do
    let!(:company) { create(:company, id: 5) }
    let!(:user1) { create(:user, email: "sharang.d+1@gmail.com", legal_name: "John Doe") }
    let!(:user2) { create(:user, email: "sharang.d+2@gmail.com", legal_name: "Jane Smith") }
    let!(:company_investor1) { create(:company_investor, company:, user: user1) }
    let!(:company_investor2) { create(:company_investor, company:, user: user2) }
    let!(:common_share_class) { create(:share_class, company:, name: "Common") }
    let!(:preferred_share_class) { create(:share_class, company:, name: "Preferred") }

    it "creates share holdings" do
      expect { described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv).process }.to change { ShareHolding.count }.by(2)
    end

    it "creates share holdings with the correct attributes" do
      described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv).process

      common_share = ShareHolding.find_by(name: "Common Stock")
      expect(common_share.number_of_shares).to eq(1000)
      expect(common_share.share_price_usd).to eq(1.0)
      expect(common_share.total_amount_in_cents).to eq(100_000)
      expect(common_share.share_holder_name).to eq("John Doe")
      expect(common_share.share_class).to eq(common_share_class)
      expect(common_share.issued_at).to eq("2024-01-01")
      expect(common_share.originally_acquired_at).to eq("2024-01-01")

      preferred_share = ShareHolding.find_by(name: "Preferred Stock")
      expect(preferred_share.number_of_shares).to eq(500)
      expect(preferred_share.share_price_usd).to eq(2.0)
      expect(preferred_share.total_amount_in_cents).to eq(100_000)
      expect(preferred_share.share_holder_name).to eq("Jane Smith")
      expect(preferred_share.share_class).to eq(preferred_share_class)
      expect(preferred_share.issued_at).to eq("2024-01-15")
      expect(preferred_share.originally_acquired_at).to eq("2024-01-15")
    end

    it "validates share holder associations correctly" do
      described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv).process

      common_share = ShareHolding.find_by(name: "Common Stock")
      expect(common_share.company_investor).to eq(company_investor1)
      expect(common_share.company_investor.user).to eq(user1)
      expect(common_share.company_investor.company).to eq(company)

      preferred_share = ShareHolding.find_by(name: "Preferred Stock")
      expect(preferred_share.company_investor).to eq(company_investor2)
      expect(preferred_share.company_investor.user).to eq(user2)
      expect(preferred_share.company_investor.company).to eq(company)
    end

    it "does not create share holdings if the company investor does not exist" do
      company_investor1.destroy!

      service = described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv)
      expect { service.process }.to change { ShareHolding.count }.by(1)
      expect(service.errors).to include({ name: "Common Stock", error_message: "Could not find an investor record" })
    end

    it "does not create share holdings if the share class does not exist" do
      common_share_class.destroy!

      service = described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv)
      expect { service.process }.to change { ShareHolding.count }.by(1)
      expect(service.errors).to include({ name: "Common Stock", error_message: "Could not find share class: Common" })
    end

    it "does not create share holdings if the share holding is invalid" do
      allow_any_instance_of(ShareHolding).to receive(:save).and_return(false)
      allow_any_instance_of(ShareHolding).to receive(:errors).and_return(double(present?: true, full_messages: ["Name can't be blank"]))

      service = described_class.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv)
      expect { service.process }.to change { ShareHolding.count }.by(0)
      expect(service.errors).to include({ name: "Common Stock", error_message: "Name can't be blank" })
    end
  end
end
