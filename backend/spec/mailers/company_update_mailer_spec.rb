# frozen_string_literal: true

RSpec.describe CompanyUpdateMailer do
  describe "#update_published" do
    let(:company) { create(:company, :completed_onboarding) }
    let(:user) { create(:user) }
    let(:company_update) { create(:company_update, company:, title: "Q1 2024 Update") }
    let(:mail) { described_class.update_published(company_update_id: company_update.id, user_id: user.id) }

    before do
      # Mock the presenter to return predictable props
      allow_any_instance_of(CompanyUpdatePresenter).to receive(:props).and_return({
        id: company_update.external_id,
        title: company_update.title,
        body: company_update.body,
        youtube_video_id: nil,
      })
    end

    it "renders the headers correctly" do
      expect(mail.subject).to eq("#{company.name}: #{company_update.title} investor update")
      expect(mail.to).to eq([user.email])
      expect(mail.from).to include(ApplicationMailer::NOREPLY_EMAIL)
      expect(mail.reply_to).to eq([company.email])
    end

    it "renders the body with company information" do
      body = mail.body.encoded
      # Account for HTML encoding
      expect(body).to include(CGI.escapeHTML(company.name))
      expect(body).to include(company_update.title)
    end

    it "calls the presenter with the correct company update" do
      presenter_double = double(CompanyUpdatePresenter)
      expect(CompanyUpdatePresenter).to receive(:new).with(company_update).and_return(presenter_double)
      expect(presenter_double).to receive(:props).and_return({
        id: company_update.external_id,
        title: company_update.title,
        body: company_update.body,
        youtube_video_id: nil,
      })

      mail.body.encoded
    end

    context "when company update has a youtube video" do
      let(:youtube_video_id) { "dQw4w9WgXcQ" }
      let(:video_url) { "https://www.youtube.com/watch?v=#{youtube_video_id}" }

      before do
        allow_any_instance_of(CompanyUpdatePresenter).to receive(:props).and_return({
          id: company_update.external_id,
          title: company_update.title,
          body: company_update.body,
          youtube_video_id: youtube_video_id,
          video_url: video_url,
        })
      end

      it "includes the video thumbnail URL in the body" do
        body = mail.body.encoded
        expect(body).to include("https://img.youtube.com/vi/#{youtube_video_id}/hqdefault.jpg")
        expect(body).to include(video_url)
      end
    end

    context "with invalid IDs" do
      it "raises an error for invalid company_update_id" do
        expect do
          described_class.update_published(company_update_id: 999999, user_id: user.id).body.encoded
        end.to raise_error(ActiveRecord::RecordNotFound)
      end

      it "raises an error for invalid user_id" do
        expect do
          described_class.update_published(company_update_id: company_update.id, user_id: 999999).body.encoded
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
