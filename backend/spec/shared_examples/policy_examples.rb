# frozen_string_literal: true

RSpec.shared_examples_for "an access-granting policy" do
  it "grants access" do
    expect(subject).to permit(
      CurrentContext.new(user: company_user.user, company: company_user.company, role: nil),
      record
    )
  end
end

RSpec.shared_examples_for "an access-granting policy for roles" do |access_roles|
  access_roles.each do |access_role|
    context "when the user is a #{access_role}" do
      let(:company_user) { send(access_role) }

      it_behaves_like "an access-granting policy"
    end
  end
end

RSpec.shared_examples_for "an access-denying policy" do
  it "denies access" do
    expect(subject).not_to permit(
      CurrentContext.new(user: company_user.user, company: company_user.company, role: nil),
      record
    )
  end
end

RSpec.shared_examples_for "an access-denying policy for roles" do |access_roles|
  access_roles.each do |access_role|
    context "when the user is a #{access_role}" do
      let(:company_user) { send(access_role) }

      it_behaves_like "an access-denying policy"
    end
  end
end
