# frozen_string_literal: true

RSpec.describe CompanyUpdate do
  describe ".months_for_period" do
    it "returns the correct number of months for the period" do
      expect(described_class.months_for_period(:month)).to eq(1)
      expect(described_class.months_for_period(:quarter)).to eq(3)
      expect(described_class.months_for_period(:year)).to eq(12)
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_and_belong_to_many(:company_monthly_financial_reports).join_table(:company_updates_financial_reports) }
    it { is_expected.to have_many(:company_updates_financial_reports).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:title) }
    it { is_expected.to validate_presence_of(:body) }
    it { is_expected.to define_enum_for(:period).with_values(month: "month", quarter: "quarter", year: "year").backed_by_column_of_type(:string) }

    it "validates period and period_started_on are both present or both blank" do
      company_update = build(:company_update, period: nil, period_started_on: nil)
      expect(company_update).to be_valid

      company_update.assign_attributes(period: nil, period_started_on: Date.new(2023, 4, 1))
      expect(company_update).to be_invalid

      company_update.assign_attributes(period: :month, period_started_on: nil)
      expect(company_update).to be_invalid

      company_update.assign_attributes(period: :month, period_started_on: Date.new(2023, 4, 1))
      expect(company_update).to be_valid
    end

    it "validates period_started_on is the start of the period" do
      company_update = build(:company_update, period: :month, period_started_on: Date.new(2023, 4, 1))
      expect(company_update).to be_valid
      company_update.period_started_on = Date.new(2023, 4, 2)
      expect(company_update).to be_invalid

      company_update.period = :quarter
      company_update.period_started_on = Date.new(2023, 4, 1)
      expect(company_update).to be_valid
      company_update.period_started_on = Date.new(2023, 5, 1)
      expect(company_update).to be_invalid

      company_update.period = :year
      company_update.period_started_on = Date.new(2023, 1, 1)
      expect(company_update).to be_valid
      company_update.period_started_on = Date.new(2023, 2, 1)
      expect(company_update).to be_invalid
    end
  end

  describe "#status" do
    let(:company_update) { build(:company_update) }

    context "when sent_at is present" do
      before { company_update.sent_at = Time.current }

      it "returns 'Sent'" do
        expect(company_update.status).to eq("Sent")
      end
    end

    context "when sent_at is nil" do
      before { company_update.sent_at = nil }

      it "returns 'Draft'" do
        expect(company_update.status).to eq("Draft")
      end
    end
  end

  describe "#youtube_video_id" do
    let(:company_update) { build(:company_update) }

    context "when video_url is not present" do
      it "returns nil" do
        expect(company_update.youtube_video_id).to be_nil
      end
    end

    context "when video_url is present but not from YouTube" do
      before { company_update.video_url = "https://vimeo.com/123456" }

      it "returns nil" do
        expect(company_update.youtube_video_id).to be_nil
      end
    end

    context "when video_url is from youtube.com" do
      before { company_update.video_url = "https://www.youtube.com/watch?params=more&v=dQw4w9WgXcQ&more=params" }

      context "when query params are present" do
        it "returns the correct youtube video id" do
          expect(company_update.youtube_video_id).to eq("dQw4w9WgXcQ")
        end
      end

      context "when query params are missing" do
        before { company_update.video_url = "https://www.youtube.com" }

        it "returns nil" do
          expect(company_update.youtube_video_id).to be_nil
        end
      end
    end

    context "when video_url is from youtu.be" do
      before { company_update.video_url = "https://youtu.be/dQw4w9WgXcQ?more=params" }

      context "when query params are present" do
        it "returns the correct youtube video id" do
          expect(company_update.youtube_video_id).to eq("dQw4w9WgXcQ")
        end
      end

      context "when query params are missing" do
        before { company_update.video_url = "https://youtu.be" }

        it "returns nil" do
          expect(company_update.youtube_video_id).to be_nil
        end
      end
    end
  end
end
