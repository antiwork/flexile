# frozen_string_literal: true

RSpec.describe ImportShareHoldings do
  let(:workbook_path) { Rails.root.join("spec", "fixtures", "files", "test_shareholders_data.xlsx").to_s }

  describe "Environment is in an unexpected state" do
    it "raises an exception if the file does not exist" do
      expect do
        described_class.new("/path/to/nonexistent.xlsx").process
      end.to raise_error(Zip::Error, %r{File /path/to/nonexistent.xlsx not found})
               .and change(ShareHolding, :count).by(0)
    end

    it "raises an exception if the workbook has an unknown email" do
      expect do
        described_class.new(workbook_path).process
      end.to raise_error(ActiveRecord::RecordNotFound)
               .and change(ShareHolding, :count).by(0)
    end

    it "raises an exception if there is no Gumroad company" do
      expect do
        described_class.new(workbook_path).process
      end.to raise_error(ActiveRecord::RecordNotFound)
               .and change(ShareHolding, :count).by(0)
    end

    it "raises an exception if there are multiple Gumroad-like companies" do
      create_pair(:company, is_gumroad: true)

      expect do
        described_class.new(workbook_path).process
      end.to raise_error(ActiveRecord::RecordNotFound)
               .and change(ShareHolding, :count).by(0)
    end
  end

  describe "Environment has the expected state" do
    let!(:gumroad) { create(:company, is_gumroad: true) }

    before do
      (1..9).each do |index|
        create(:user, email: "sharang.d+#{index}@gmail.com")
      end
      create(:share_class, company: gumroad, name: "Series Seed")
      create(:share_class, company: gumroad, name: "Series A")
      create(:share_class, company: gumroad, name: "Series B")
      create(:share_class, company: gumroad, name: "Series C")
      create(:share_class, company: gumroad, name: "Series D")
      create(:share_class, company: gumroad, name: "Common")
    end

    it "skips creation of shares that don't have matching investor records" do
      (1..2).each do |index|
        user = User.find_by(email: "sharang.d+#{index}@gmail.com")
        create(:company_investor, company: gumroad, user:)
      end

      expect do
        service = described_class.new(workbook_path)
        service.process
        expect(service.errors).to match_array([
                                                { name: "S1-11", error_message: "Could not find an investor record" },
                                                { name: "S1-44", error_message: "Could not find an investor record" },
                                                { name: "K2-5", error_message: "Could not find an investor record" },
                                                { name: "L2-4", error_message: "Could not find an investor record" },
                                                { name: "P-12", error_message: "Could not find an investor record" },
                                                { name: "B-12", error_message: "Could not find an investor record" },
                                                { name: "M-1", error_message: "Could not find an investor record" }
                                              ])
      end.to change(ShareHolding, :count).by(3)

      [["S1-16", "sharang.d+1@gmail.com", 12345, 70.0, 49999.77, "09/01/22", "Series C"],
       ["S1-18", "sharang.d+2@gmail.com", 6789, 70.0, 99999.54, "09/01/22", "Series C"],
       ["S3-22", "sharang.d+1@gmail.com", 435345, 30.0, 49999.77, "05/07/12", "Series Seed"],
      ].each do |(name, email, number_of_shares, share_price_in_cents, total_amount, date, share_type)|
        company_investor = User.find_by(email:).company_investors.where(company: gumroad).sole
        share_class = ShareClass.find_by(name: share_type, company: gumroad)
        issued_at = Date.strptime(date, "%m/%d/%y")
        shares = company_investor.share_holdings.where(name:, number_of_shares:, share_price_usd: share_price_in_cents / 100.to_d,
                                                       issued_at:, originally_acquired_at: issued_at, share_class:,
                                                       total_amount_in_cents: total_amount * 100,
                                                       share_holder_name: company_investor.user.legal_name)
        expect(shares.count).to eq(1)
      end
    end

    it "creates shareholdings for all users" do
      (1..9).each do |index|
        user = User.find_by(email: "sharang.d+#{index}@gmail.com")
        create(:company_investor, company: gumroad, user:)
      end

      expect do
        service = described_class.new(workbook_path)
        service.process
        expect(service.errors).to eq([])
      end.to change(ShareHolding, :count).by(10)

      [["S1-16", "sharang.d+1@gmail.com", 12345, 70.0, 49999.77, "09/01/22", "Series C"],
       ["S1-18", "sharang.d+2@gmail.com", 6789, 70.0, 99999.54, "09/01/22", "Series C"],
       ["S1-11", "sharang.d+4@gmail.com", 1012, 865.0, 20831.63, "05/08/12", "Series D"],
       ["S1-44", "sharang.d+5@gmail.com", 131451, 865.0, 2343242, "05/08/12", "Series D"],
       ["S3-22", "sharang.d+1@gmail.com", 435345, 30.0, 49999.77, "05/07/12", "Series Seed"],
       ["K2-5", "sharang.d+6@gmail.com", 3455, 23.0, 277386.82, "05/07/12", "Series A"],
       ["L2-4", "sharang.d+3@gmail.com", 5345, 45.0, 99999.54, "05/07/12", "Series B"],
       ["P-12", "sharang.d+7@gmail.com", 345345, 300.0, 26780.06, "05/08/12", "Common"],
       ["B-12", "sharang.d+8@gmail.com", 112, 300.0, 39999.33, "05/07/12", "Common"],
       ["M-1", "sharang.d+9@gmail.com", 444, 300.0, 25521.21, "05/07/12", "Common"]
      ].each do |(name, email, number_of_shares, share_price_in_cents, total_amount, date, share_type)|
        company_investor = User.find_by(email:).company_investors.where(company: gumroad).sole
        share_class = ShareClass.find_by(name: share_type, company: gumroad)
        issued_at = Date.strptime(date, "%m/%d/%y")
        shares = company_investor.share_holdings.where(name:, number_of_shares:, share_price_usd: share_price_in_cents / 100.to_d,
                                                       issued_at:, originally_acquired_at: issued_at, share_class:,
                                                       total_amount_in_cents: total_amount * 100,
                                                       share_holder_name: company_investor.user.legal_name)
        expect(shares.count).to eq(1)
      end
    end
  end
end
