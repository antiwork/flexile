# frozen_string_literal: true

RSpec.describe TimeEntry do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:company) }
  end
end
