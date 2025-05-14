# frozen_string_literal: true

RSpec.describe OnboardingState::BaseUser do
  let(:company_worker) { create(:company_worker) }

  it "disallows creation of an instance of the class" do
    expect do
      described_class.new(user: company_worker.user, company: company_worker.company)
    end.to raise_error(NotImplementedError, /OnboardingState::BaseUser is an abstract class and cannot be instantiated/)
  end

  it "allows creation of an instance of a child class" do
    Klass = Class.new(described_class)
    expect do
      Klass.new(user: company_worker.user, company: company_worker.company)
    end.not_to raise_error
  end
end
