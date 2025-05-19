# frozen_string_literal: true

RSpec.describe SignUpCompany do
  let(:email) { generate(:email) }
  let(:args) do
    params = ActionController::Parameters.new(email:,
                                              password: "password").permit!
    { user_attributes: params, ip_address: "1.2.3.4" }
  end

  it "rolls back the transaction if validation fails" do
    allow_any_instance_of(CompanyAdministrator).to receive(:save!) do |instance|
      instance.errors.add(:base, "I was meant to error!")
      raise ActiveRecord::RecordInvalid.new(instance)
    end

    expect do
      result = described_class.new(**args).perform
      expect(result).to eq(success: false, error_message: "I was meant to error!")
    end.to change(User, :count).by(0)
       .and change(TosAgreement, :count).by(0)
       .and change(Company, :count).by(0)
       .and change(CompanyAdministrator, :count).by(0)
  end

  it "returns a successful response when all data is valid" do
    expect do
      result = described_class.new(**args).perform
      expect(result).to eq(success: true, user: User.last)
    end.to change(User, :count).by(1)
       .and change(TosAgreement, :count).by(1)
       .and change(Company, :count).by(1)
       .and change(CompanyAdministrator, :count).by(1)

    user = User.last
    expect(user.email).to eq args[:user_attributes][:email]
    expect(user.country_code).to eq "US"

    tos_agreement = TosAgreement.last
    expect(tos_agreement.user).to eq user
    expect(tos_agreement.ip_address).to eq "1.2.3.4"

    company = Company.last
    expect(company.email).to eq args[:user_attributes][:email]
    expect(company.country_code).to eq "US"

    company_admin = CompanyAdministrator.last
    expect(company_admin.user).to eq user
    expect(company_admin.company).to eq company
  end
end
