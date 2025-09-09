# frozen_string_literal: true

RSpec.describe "Tax Settings" do
  let(:company) { create(:company, :completed_onboarding) }
  let(:user) do
    user = create(:user, :without_compliance_info, legal_name: "Caro Example", preferred_name: "Caro",
                                                   email: "caro@example.com", birth_date: Date.new(1980, 6, 27))
    create(:user_compliance_info, user:, tax_id: "123-45-6789")
    user
  end

  before { sign_in user }

  context "as a contractor" do
    let!(:company_worker) { create(:company_worker, company:, user:) }

    before do
      company_administrator = create(:company_administrator, company:)
      user.update!(invited_by_id: company_administrator.user_id)
    end
  end
end
