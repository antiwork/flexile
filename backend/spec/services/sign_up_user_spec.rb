# frozen_string_literal: true

RSpec.describe SignUpUser do
  let(:email) { generate(:email) }
  let(:args) do
    params = ActionController::Parameters.new(email:,
                                              password: "password").permit!
    { user_attributes: params, ip_address: "1.2.3.4" }
  end

  it "rolls back the transaction if validation fails" do
    allow_any_instance_of(User).to receive(:save!) do |instance|
      instance.errors.add(:base, "I was meant to error!")
      raise ActiveRecord::RecordInvalid.new(instance)
    end

    expect do
      result = described_class.new(**args).perform
      expect(result).to eq(success: false, error_message: "I was meant to error!")
    end.to change(User, :count).by(0)
       .and change(TosAgreement, :count).by(0)
  end

  it "returns a successful response when all data is valid" do
    expect do
      result = described_class.new(**args).perform
      expect(result).to eq(success: true, user: User.last)
    end.to change(User, :count).by(1)
       .and change(TosAgreement, :count).by(1)

    user = User.last
    expect(user.email).to eq args[:user_attributes][:email]

    tos_agreement = user.tos_agreements.last
    expect(tos_agreement.ip_address).to eq "1.2.3.4"
  end
end
