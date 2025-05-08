# frozen_string_literal: true

RSpec.shared_examples_for "inherits from Internal::Settings::BaseController" do
  it { is_expected.to be_a_kind_of(Internal::Settings::BaseController) }
end
