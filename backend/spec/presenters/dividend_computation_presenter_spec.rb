# frozen_string_literal: true

RSpec.describe DividendComputationPresenter do
  let(:company) { create(:company) }
  let(:dividend_computation) do
    create(:dividend_computation,
           company: company,
           total_amount_in_usd: 10_000.50,
           dividends_issuance_date: Date.new(2024, 3, 15),
           return_of_capital: false,
           created_at: Time.zone.parse("2024-03-15T10:00:00Z"),
           updated_at: Time.zone.parse("2024-03-15T15:30:00Z"))
  end
  
  let(:user1) { create(:user, name: "John Doe") }
  let(:user2) { create(:user, name: "Jane Smith") }
  let(:company_investor1) { create(:company_investor, company: company, user: user1) }
  let(:company_investor2) { create(:company_investor, company: company, user: user2) }
  
  let!(:output1) do
    create(:dividend_computation_output,
           dividend_computation: dividend_computation,
           company_investor: company_investor1,
           investor_name: "John Doe Custom",
           share_class: "Series A",
           number_of_shares: 1000,
           hurdle_rate: 8.5,
           original_issue_price_in_usd: 2.00,
           preferred_dividend_amount_in_usd: 170.00,
           dividend_amount_in_usd: 2500.25,
           qualified_dividend_amount_usd: 2000.00,
           total_amount_in_usd: 2670.25)
  end
  
  let!(:output2) do
    create(:dividend_computation_output,
           dividend_computation: dividend_computation,
           company_investor: company_investor2,
           investor_name: nil, # Will use user name
           share_class: "Common",
           number_of_shares: 2000,
           hurdle_rate: nil,
           original_issue_price_in_usd: nil,
           preferred_dividend_amount_in_usd: 0.00,
           dividend_amount_in_usd: 7330.25,
           qualified_dividend_amount_usd: 5500.00,
           total_amount_in_usd: 7330.25)
  end
  
  let(:presenter) { described_class.new(dividend_computation) }

  describe "#summary" do
    subject { presenter.summary }

    it "returns basic dividend computation information" do
      expect(subject).to eq({
        id: dividend_computation.id,
        total_amount_in_usd: 10_000.50,
        dividends_issuance_date: "2024-03-15",
        return_of_capital: false,
        created_at: "2024-03-15T10:00:00Z",
        updated_at: "2024-03-15T15:30:00Z",
        number_of_outputs: 2
      })
    end

    context "when dividend computation has return of capital" do
      before { dividend_computation.update!(return_of_capital: true) }

      it "includes return_of_capital as true" do
        expect(subject[:return_of_capital]).to be true
      end
    end

    context "when dividend computation has no outputs" do
      before { dividend_computation.dividend_computation_outputs.destroy_all }

      it "shows zero outputs" do
        expect(subject[:number_of_outputs]).to eq(0)
      end
    end
  end

  describe "#detailed_view" do
    subject { presenter.detailed_view }

    it "returns comprehensive dividend computation information" do
      expect(subject).to include({
        id: dividend_computation.id,
        total_amount_in_usd: 10_000.50,
        dividends_issuance_date: "2024-03-15",
        return_of_capital: false,
        created_at: "2024-03-15T10:00:00Z",
        updated_at: "2024-03-15T15:30:00Z"
      })
      
      expect(subject).to have_key(:computation_outputs)
      expect(subject).to have_key(:totals)
    end

    describe "computation_outputs" do
      let(:outputs) { subject[:computation_outputs] }

      it "returns array of computation output data" do
        expect(outputs).to be_an(Array)
        expect(outputs.length).to eq(2)
      end

      it "includes output details for first investor with custom name" do
        output = outputs.find { |o| o[:investor_name] == "John Doe Custom" }
        
        expect(output).to include({
          id: output1.id,
          investor_name: "John Doe Custom",
          share_class: "Series A",
          number_of_shares: 1000,
          hurdle_rate: 8.5,
          original_issue_price_in_usd: 2.00,
          preferred_dividend_amount_in_usd: 170.00,
          dividend_amount_in_usd: 2500.25,
          qualified_dividend_amount_usd: 2000.00,
          total_amount_in_usd: 2670.25
        })
      end

      it "includes output details for second investor using user name" do
        output = outputs.find { |o| o[:investor_name] == "Jane Smith" }
        
        expect(output).to include({
          id: output2.id,
          investor_name: "Jane Smith",
          share_class: "Common",
          number_of_shares: 2000,
          hurdle_rate: nil,
          original_issue_price_in_usd: nil,
          preferred_dividend_amount_in_usd: 0.00,
          dividend_amount_in_usd: 7330.25,
          qualified_dividend_amount_usd: 5500.00,
          total_amount_in_usd: 7330.25
        })
      end
    end

    describe "totals" do
      let(:totals) { subject[:totals] }

      it "calculates correct totals from all outputs" do
        expect(totals).to eq({
          total_shareholders: 2,
          total_preferred_dividends: 170.00,
          total_common_dividends: 9830.50, # 2500.25 + 7330.25
          total_qualified_dividends: 7500.00, # 2000.00 + 5500.00
          grand_total: 10000.50 # 2670.25 + 7330.25
        })
      end
    end

    context "when computation has no outputs" do
      before { dividend_computation.dividend_computation_outputs.destroy_all }

      it "returns empty arrays and zero totals" do
        expect(subject[:computation_outputs]).to eq([])
        expect(subject[:totals]).to eq({
          total_shareholders: 0,
          total_preferred_dividends: 0.0,
          total_common_dividends: 0.0,
          total_qualified_dividends: 0.0,
          grand_total: 0.0
        })
      end
    end
  end

  describe "edge cases" do
    context "when investor_name is present but company_investor is nil" do
      before do
        output1.update!(company_investor: nil, investor_name: "External Investor")
      end

      it "uses the investor_name" do
        outputs = presenter.detailed_view[:computation_outputs]
        external_output = outputs.find { |o| o[:investor_name] == "External Investor" }
        
        expect(external_output[:investor_name]).to eq("External Investor")
      end
    end

    context "when both investor_name and company_investor are nil" do
      before do
        output1.update!(company_investor: nil, investor_name: nil)
      end

      it "handles gracefully with nil investor name" do
        outputs = presenter.detailed_view[:computation_outputs]
        unnamed_output = outputs.find { |o| o[:id] == output1.id }
        
        expect(unnamed_output[:investor_name]).to be_nil
      end
    end

    context "when company_investor user is nil" do
      before do
        output1.update!(investor_name: nil)
        allow(output1.company_investor).to receive(:user).and_return(nil)
      end

      it "handles gracefully when user is missing" do
        outputs = presenter.detailed_view[:computation_outputs]
        output = outputs.find { |o| o[:id] == output1.id }
        
        expect(output[:investor_name]).to be_nil
      end
    end

    context "with decimal precision" do
      before do
        output1.update!(
          preferred_dividend_amount_in_usd: 123.456789,
          dividend_amount_in_usd: 987.654321,
          qualified_dividend_amount_usd: 555.123456,
          total_amount_in_usd: 1111.234567
        )
      end

      it "preserves decimal precision in output" do
        outputs = presenter.detailed_view[:computation_outputs]
        output = outputs.find { |o| o[:id] == output1.id }
        
        expect(output[:preferred_dividend_amount_in_usd]).to eq(123.456789)
        expect(output[:dividend_amount_in_usd]).to eq(987.654321)
        expect(output[:qualified_dividend_amount_usd]).to eq(555.123456)
        expect(output[:total_amount_in_usd]).to eq(1111.234567)
      end
    end
  end
end