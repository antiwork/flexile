# frozen_string_literal: true

RSpec.describe CreateInvestors do
  let(:dividend_date) { Date.parse("June 1, 2024") }

  describe "#process" do
    describe "Environment is in an undesirable state" do
      before do
        data = <<~CSV
          email,legal_name,preferred_name,billing_entity_name,investment_amount,street_address,city,region,postal_code,country
          someone@example.com,Someone Somewhere,Someone,,1000,12th Street,New York,NY,10010,United States
          nobody@example.org,Nobody Nowhere,,,1000,,,,,
        CSV
        @csv = Tempfile.new
        @csv << data
        @csv.flush
      end

      after { @csv.close! }

      it "raises an exception if the CSV does not exist" do
        expect do
          described_class.new("/path/to/nonexistent.csv", dividend_date:).process
        end.to raise_error(Errno::ENOENT)
           .and change(User, :count).by(0)
           .and change(CompanyInvestor, :count).by(0)
      end

      it "raises an exception if there is no Gumroad company" do
        expect do
          described_class.new(@csv.path, dividend_date:).process
        end.to raise_error(ActiveRecord::RecordNotFound)
           .and change(User, :count).by(0)
           .and change(CompanyInvestor, :count).by(0)
      end

      it "raises an exception if there are multiple Gumroad-like companies" do
        create_pair(:company, is_gumroad: true)

        expect do
          described_class.new(@csv.path, dividend_date:).process
        end.to raise_error(ActiveRecord::SoleRecordExceeded, /Wanted only one Company/)
           .and change(User, :count).by(0)
           .and change(CompanyInvestor, :count).by(0)
      end

      it "raises an exception if there is no company administrator for Gumroad" do
        create(:company, is_gumroad: true)

        expect do
          described_class.new(@csv.path, dividend_date:).process
        end.to raise_error(ActiveRecord::RecordNotFound)
           .and change(User, :count).by(0)
           .and change(CompanyInvestor, :count).by(0)
      end
    end

    describe "Environment and data are both good" do
      let!(:gumroad) { create(:company, is_gumroad: true) }
      let!(:company_admin) { create(:company_administrator, company: gumroad) }
      let!(:contractor) { create(:company_worker, company: gumroad) }

      before do
        data = <<~CSV
          email,legal_name,preferred_name,billing_entity_name,investment_amount,street_address,city,region,postal_code,country
          john@example.com,John Smith,John,,1000,12th Street,New York,NY,10010,United States
          jane@example.org,Jane Doe,,,999.67,,,,,
          hi@example.net,Boss Man,Boss,Acme Inc.,200123.83,"Office 89, 2nd Street",Boston,Massachusetts,12345,United States
          #{contractor.user.email},#{contractor.user.legal_name},,,500.23,,,,,Canada
        CSV
        @csv = Tempfile.new
        @csv << data
        @csv.flush
      end

      after { @csv.close! }

      context "when running in the production environment" do
        before do
          allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
        end

        it "creates investors and invites them if they're not registered on Flexile", :vcr do
          expect do
            described_class.new(@csv.path, dividend_date:).process
          end.to change(User, :count).by(3)
             .and change(CompanyInvestor, :count).by(4)
             .and have_enqueued_job(ActionMailer::MailDeliveryJob).exactly(3).times

          user = User.find_by(email: "john@example.com", legal_name: "John Smith", preferred_name: "John",
                              street_address: "12th Street", city: "New York", state: "NY", zip_code: "10010",
                              country_code: "US")
          expect(user).to be_present
          expect(user.business_entity?).to eq(false)
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 1000_00)
          expect(investor).to be_present

          user = User.find_by(email: "jane@example.org", legal_name: "Jane Doe")
          expect(user).to be_present
          expect(user.business_entity?).to eq(false)
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 999_67)
          expect(investor).to be_present

          user = User.find_by(email: "hi@example.net", legal_name: "Boss Man", preferred_name: "Boss",
                              street_address: "Office 89, 2nd Street", city: "Boston",
                              state: "Massachusetts", zip_code: "12345", country_code: "US")
          expect(user).to be_present
          expect(user.business_entity?).to eq(true)
          expect(user.business_name).to eq("Acme Inc.")
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 200_123_83)
          expect(investor).to be_present

          investor = contractor.user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 500_23)
          expect(investor).to be_present
        end
      end

      context "when running in a non-production environment" do
        it "creates investors and invites them using test email addresses", :vcr do
          expect do
            described_class.new(@csv.path, dividend_date:).process
          end.to change(User, :count).by(4)
             .and change(CompanyInvestor, :count).by(4)
             .and have_enqueued_job(ActionMailer::MailDeliveryJob).exactly(4).times

          user = User.find_by(email: "sharang.d+1@gmail.com", legal_name: "John Smith", preferred_name: "John",
                              street_address: "12th Street", city: "New York", state: "NY", zip_code: "10010",
                              country_code: "US")
          expect(user).to be_present
          expect(user.business_entity?).to eq(false)
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 1000_00)
          expect(investor).to be_present

          user = User.find_by(email: "sharang.d+2@gmail.com", legal_name: "Jane Doe")
          expect(user).to be_present
          expect(user.business_entity?).to eq(false)
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 999_67)
          expect(investor).to be_present

          user = User.find_by(email: "sharang.d+3@gmail.com", legal_name: "Boss Man", preferred_name: "Boss",
                              street_address: "Office 89, 2nd Street", city: "Boston",
                              state: "Massachusetts", zip_code: "12345", country_code: "US")
          expect(user).to be_present
          expect(user.business_entity?).to eq(true)
          expect(user.business_name).to eq("Acme Inc.")
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 200_123_83)
          expect(investor).to be_present

          user = User.find_by(email: "sharang.d+4@gmail.com", legal_name: contractor.user.legal_name, country_code: "CA")
          expect(user).to be_present
          expect(user.business_entity?).to eq(false)
          investor = user.company_investors.where(company_id: gumroad.id, investment_amount_in_cents: 500_23)
          expect(investor).to be_present
        end
      end
    end
  end

  describe "#errors" do
    let!(:gumroad) { create(:company, is_gumroad: true) }
    let!(:company_admin) { create(:company_administrator, company: gumroad) }

    before do
      data = <<~CSV
        email,legal_name,preferred_name,billing_entity_name,investment_amount,street_address,city,region,postal_code,country
        sharang.d+1@gmail.com,John Smith,John,,#{amount},12th Street,New York,NY,10010,United States
      CSV
      @csv = Tempfile.new
      @csv << data
      @csv.flush
    end

    after { @csv.close! }

    context "when there are validation errors" do
      let(:amount) { "" }

      it "returns the errors" do
        service = described_class.new(@csv.path, dividend_date:)
        service.process
        expect(service.errors).to eq([{ email: "sharang.d+1@gmail.com", error_message: "Investment amount is missing" }])
      end
    end

    context "when there are no validation errors", :vcr do
      let(:amount) { 1000 }

      it "returns an empty array" do
        service = described_class.new(@csv.path, dividend_date:)
        service.process
        expect(service.errors).to eq([])
      end
    end
  end
end
