# frozen_string_literal: true

RSpec.describe CompanyWorkerUpdateTask, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:company_worker_update) }
  end
end
