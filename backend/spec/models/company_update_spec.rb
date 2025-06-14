# frozen_string_literal: true

RSpec.describe CompanyUpdate do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:title) }
    it { is_expected.to validate_presence_of(:body) }
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
