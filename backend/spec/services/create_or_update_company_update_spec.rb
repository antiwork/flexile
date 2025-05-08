# frozen_string_literal: true

RSpec.describe CreateOrUpdateCompanyUpdate do
  let(:company) { create(:company) }
  let(:company_update_params) do
    {
      title: "Update title",
      body: "Update body",
      period: "month",
      period_started_on: "2023-04-01",
      video_url: "https://example.com/video",
      show_revenue: "true",
      show_net_income: "true",
    }
  end

  before do
    allow(Time).to receive(:current).and_return(Time.zone.local(2023, 5, 15))
  end

  describe "#perform!" do
    subject(:result) { described_class.new(company:, company_update_params:).perform! }

    context "when creating a new company update" do
      it "creates a new company update with the correct attributes" do
        expect { result }.to change(company.company_updates, :count).by(1)
        expect(result[:success]).to be true
        expect(result[:company_update]).to eq(company.company_updates.last)

        company_update = result[:company_update]
        expect(company_update.body).to eq("Update body")
        expect(company_update.title).to eq("Update title")
        expect(company_update.period).to eq("month")
        expect(company_update.period_started_on).to eq(Date.new(2023, 4, 1))
        expect(company_update.video_url).to eq("https://example.com/video")
      end

      context "when there are financial reports for the period" do
        let!(:company_monthly_financial_report) do
          create(
            :company_monthly_financial_report,
            company:,
            month: 4,
            year: 2023,
            net_income_cents: 100_00,
            revenue_cents: 500_00
          )
        end

        it "sets the financial flags based on the params" do
          company_update = result[:company_update]
          expect(company_update.company_monthly_financial_reports).to eq([company_monthly_financial_report])
          expect(company_update.show_revenue).to eq(true)
          expect(company_update.show_net_income).to eq(true)
        end
      end

      context "when there are no financial reports for the period" do
        it "sets the financial flags to false" do
          company_update = result[:company_update]
          expect(company_update.show_revenue).to eq(false)
          expect(company_update.show_net_income).to eq(false)
        end
      end
    end

    context "when updating an existing company update" do
      let!(:company_update) { create(:company_update, company:) }
      subject(:result) do
        described_class.new(company:, company_update_params:, company_update:).perform!
      end

      it "does not create a new company update" do
        expect { result }.not_to change(CompanyUpdate, :count)
      end

      it "updates the existing company update" do
        expect { result }.to change { company_update.reload.title }.to("Update title")
      end

      it "keeps the financial period unless the user changes it" do
        allow(Time).to receive(:current).and_return(Time.zone.local(2024, 8, 15))
        company_update = result[:company_update]
        expect(company_update.period).to eq("month")
        expect(company_update.period_started_on).to eq(Date.new(2023, 4, 1))
      end

      context "when the financial reports are already attached" do
        let!(:company_monthly_financial_report) do
          create(
            :company_monthly_financial_report,
            company:,
            month: 4,
            year: 2023,
            net_income_cents: 100_00,
            revenue_cents: 500_00
          )
        end

        before do
          company_update.update!(
            company_monthly_financial_reports: [company_monthly_financial_report],
            show_revenue: true,
            show_net_income: true
          )
        end

        context "when the financial report is no longer available" do
          before do
            company_monthly_financial_report.destroy!
          end

          it "removes the financial report and resets the financial flags to false" do
            company_update = result[:company_update]
            expect(company_update.company_monthly_financial_reports).to eq([])
            expect(company_update.show_revenue).to eq(false)
            expect(company_update.show_net_income).to eq(false)
          end
        end
      end
    end

    context "when validation fails" do
      before { company_update_params[:title] = "" }

      it "raises an error" do
        expect { result }.to raise_error(ActiveRecord::RecordInvalid).with_message(/Title can't be blank/)
      end

      it "does not create a new company update" do
        expect { result }.to raise_error(ActiveRecord::RecordInvalid, /Title can't be blank/)
          .and not_change(CompanyUpdate, :count)
      end
    end

    context "when processing different periods" do
      context "without financial period" do
        let(:company_update_params) { super().deep_merge(period: nil, period_started_on: nil) }

        it "doesn't attach financial reports and sets financial flags to false" do
          company_update = result[:company_update]

          expect(company_update.company_monthly_financial_reports.size).to eq(0)
          expect(company_update.show_revenue).to eq(false)
          expect(company_update.show_net_income).to eq(false)
        end
      end

      context "with month period" do
        let(:company_update_params) { super().deep_merge(period: "month") }

        it "sets the correct financial reports" do
          create(:company_monthly_financial_report, company: company, year: 2023, month: 4)
          company_update = result[:company_update]

          expect(company_update.company_monthly_financial_reports.size).to eq(1)
          expect(company_update.company_monthly_financial_reports.first.month).to eq(4)
        end
      end

      context "with quarter period" do
        let(:company_update_params) { super().deep_merge(period: "quarter", period_started_on: "2023-01-01") }

        it "sets the correct financial reports" do
          [1, 2, 3].each do |month|
            create(:company_monthly_financial_report, company:, year: 2023, month:)
          end
          company_update = result[:company_update]

          expect(company_update.company_monthly_financial_reports.size).to eq(3)
          expect(company_update.company_monthly_financial_reports.map(&:month)).to contain_exactly(1, 2, 3)
        end
      end

      context "with year period" do
        let(:company_update_params) { super().deep_merge(period: "year", period_started_on: "2022-01-01") }

        it "sets the correct financial reports" do
          (1..12).each do |month|
            create(:company_monthly_financial_report, company:, year: 2022, month:)
          end
          company_update = result[:company_update]

          expect(company_update.company_monthly_financial_reports.size).to eq(12)
          expect(company_update.company_monthly_financial_reports.map(&:year).uniq).to eq([2022])
        end
      end
    end
  end
end
