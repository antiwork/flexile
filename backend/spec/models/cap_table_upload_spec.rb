# frozen_string_literal: true

RSpec.describe CapTableUpload do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:files) }
    it { is_expected.to validate_inclusion_of(:status).in_array(described_class::STATUSES) }
  end
end
