# frozen_string_literal: true

RSpec.describe CreateOptionPool do
  let(:company) { create(:company) }
  let(:share_class) { create(:share_class, company: company, name: "Common") }

  it "creates an option pool with issued_shares=0 and returns success" do
    result = described_class.new(
      company: company,
      name: "2025 Equity plan",
      authorized_shares: 1_000_000,
      share_class: share_class,
      default_option_expiry_months: 120,
      voluntary_termination_exercise_months: 120,
      involuntary_termination_exercise_months: 120,
      termination_with_cause_exercise_months: 0,
      death_exercise_months: 120,
      disability_exercise_months: 120,
      retirement_exercise_months: 120,
    ).process

    expect(result[:success]).to be(true)
    pool = result[:option_pool]
    expect(pool).to be_persisted
    expect(pool.company).to eq(company)
    expect(pool.share_class).to eq(share_class)
    expect(pool.name).to eq("2025 Equity plan")
    expect(pool.authorized_shares).to eq(1_000_000)
    expect(pool.issued_shares).to eq(0)
    expect(pool.available_shares).to eq(1_000_000)
  end

  it "fails if share class missing" do
    result = described_class.new(
      company: company,
      name: "x",
      authorized_shares: 1,
      share_class: nil,
      default_option_expiry_months: 120,
      voluntary_termination_exercise_months: 120,
      involuntary_termination_exercise_months: 120,
      termination_with_cause_exercise_months: 0,
      death_exercise_months: 120,
      disability_exercise_months: 120,
      retirement_exercise_months: 120,
    ).process

    expect(result[:success]).to be(false)
    expect(result[:error]).to match(/Share class must be selected/)
  end
end
