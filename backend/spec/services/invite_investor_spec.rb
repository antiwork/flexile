# frozen_string_literal: true

RSpec.describe InviteInvestor do
  let(:email) { generate(:email) }
  let(:yesterday) { Date.yesterday }
  let(:investor_params) do
    {
      investment_amount_in_cents: 123_45,
    }
  end
  let(:user_params) { { email:, country_code: "US" } }
  let(:dividend_date) { Date.parse("12 December, 2024") }
  let(:company) do create(:company, name: "Gumroad", street_address: "548 Market Street", city: "San Francisco",
                                    state: "CA", zip_code: "94104-5401", country_code: "US") end
  let!(:current_user) { create(:user) }

  it "creates the record when all information is present", :vcr do
    expect do
      result = described_class.new(current_user:, company:, investor_params:, user_params:, dividend_date:).perform
      expect(result).to eq({ success: true })
    end.to change { User.count }.by(1)
       .and change { CompanyInvestor.count }.by(1)
       .and have_enqueued_mail(DeviseMailer, :invitation_instructions).with(
         instance_of(User), instance_of(String),
         {
           subject: "Action required: start earning distributions on your investment in Gumroad",
           reply_to: current_user.email,
           template_name: "investor_invitation_instructions",
           dividend_date:,
         }
       )

    user = User.last
    expect(user.email).to eq(email)
    expect(user.country_code).to eq("US")

    investor = CompanyInvestor.last
    expect(investor.user).to eq(user)
    expect(investor.company).to eq(company)
    expect(investor.investment_amount_in_cents).to eq(123_45)
  end

  context "when a user with the same email address already exists" do
    before do
      create(:user, email:)
    end

    it "returns an invalid email error message" do
      expect do
        result = described_class.new(current_user:, company:, investor_params:, user_params:, dividend_date:).perform
        expect(result).to eq({ success: false, error_message: "Email has already been taken" })
      end.to change { User.count }.by(0)
         .and change { CompanyInvestor.count }.by(0)
    end
  end

  context "when investor details are missing" do
    it "returns an error message if the email is missing" do
      expect do
        result =
          described_class.new(current_user:, company:, investor_params:, user_params: user_params.merge(email: ""), dividend_date:)
                         .perform
        expect(result).to eq({ success: false, error_message: "Please specify the email" })
      end.to change { User.count }.by(0)
         .and change { CompanyInvestor.count }.by(0)
    end
  end

  context "when investor details are invalid" do
    let(:params) { investor_params.except(:investment_amount_in_cents) }

    it "returns investor specific validation error messages", :vcr do
      error = "Investment amount in cents can't be blank and Investment amount in cents is not a number"
      expect do
        result = described_class.new(current_user:, company:, investor_params: params, user_params:, dividend_date:).perform
        expect(result).to eq({ success: false, error_message: error })
      end.to change { User.count }.by(0)
         .and change { CompanyInvestor.count }.by(0)
    end
  end
end
