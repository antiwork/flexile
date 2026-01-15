# frozen_string_literal: true

RSpec.describe Webhooks::GithubController do
  let(:webhook_secret) { "test_webhook_secret" }

  before do
    allow(GlobalConfig).to receive(:get).and_call_original
    allow(GlobalConfig).to receive(:get).with("GH_WEBHOOK_SECRET").and_return(webhook_secret)
  end

  def generate_signature(payload)
    "sha256=" + OpenSSL::HMAC.hexdigest(
      OpenSSL::Digest.new("sha256"),
      webhook_secret,
      payload
    )
  end

  describe "POST #create" do
    context "with invalid signature" do
      it "returns unauthorized" do
        payload = { action: "opened" }.to_json
        request.headers["HTTP_X_HUB_SIGNATURE_256"] = "sha256=invalid"
        request.headers["HTTP_X_GITHUB_EVENT"] = "ping"
        request.headers["CONTENT_TYPE"] = "application/json"

        post :create, body: payload

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized when signature is missing" do
        payload = { action: "opened" }.to_json
        request.headers["HTTP_X_GITHUB_EVENT"] = "ping"
        request.headers["CONTENT_TYPE"] = "application/json"

        post :create, body: payload

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with valid signature" do
      def send_webhook(event_type, payload)
        payload_json = payload.to_json
        request.headers["HTTP_X_HUB_SIGNATURE_256"] = generate_signature(payload_json)
        request.headers["HTTP_X_GITHUB_EVENT"] = event_type
        request.headers["CONTENT_TYPE"] = "application/json"
        post :create, body: payload_json
      end

      describe "ping event" do
        it "responds with ok" do
          send_webhook("ping", { zen: "Responsive is better than fast." })

          expect(response).to have_http_status(:ok)
        end
      end

      describe "pull_request event" do
        let(:company) { create(:company, github_org_name: "antiwork") }
        let(:contractor) { create(:user) }
        let!(:company_contractor) { create(:company_contractor, company: company, user: contractor) }
        let!(:invoice) { create(:invoice, company_contractor: company_contractor) }
        let!(:line_item) do
          invoice.invoice_line_items.first.update!(
            github_pr_url: "https://github.com/antiwork/flexile/pull/123",
            github_pr_number: 123,
            github_pr_repo: "antiwork/flexile",
            github_pr_title: "Original title",
            github_pr_state: "open",
            github_pr_author: "contributor"
          )
          invoice.invoice_line_items.first
        end

        it "updates line item when PR is opened" do
          payload = {
            action: "opened",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "New feature",
              state: "open",
              draft: false,
              merged_at: nil,
              user: { login: "newcontributor" },
              labels: [],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_title).to eq("New feature")
          expect(line_item.github_pr_author).to eq("newcontributor")
        end

        it "updates line item when PR is closed" do
          payload = {
            action: "closed",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "Feature PR",
              state: "closed",
              draft: false,
              merged_at: nil,
              user: { login: "contributor" },
              labels: [],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_state).to eq("closed")
        end

        it "updates line item when PR is merged" do
          payload = {
            action: "closed",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "Feature PR",
              state: "closed",
              draft: false,
              merged_at: "2024-01-15T10:00:00Z",
              user: { login: "contributor" },
              labels: [],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_state).to eq("merged")
        end

        it "updates line item when PR is converted to draft" do
          payload = {
            action: "converted_to_draft",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "Feature PR",
              state: "open",
              draft: true,
              merged_at: nil,
              user: { login: "contributor" },
              labels: [],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_state).to eq("draft")
        end

        it "updates line item when PR is ready for review" do
          line_item.update!(github_pr_state: "draft")

          payload = {
            action: "ready_for_review",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "Feature PR",
              state: "open",
              draft: false,
              merged_at: nil,
              user: { login: "contributor" },
              labels: [],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_state).to eq("open")
        end

        it "updates bounty when PR is labeled" do
          payload = {
            action: "labeled",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "Feature PR",
              state: "open",
              draft: false,
              merged_at: nil,
              user: { login: "contributor" },
              labels: [{ name: "$500" }],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_bounty_cents).to eq(50000)
        end

        it "clears PR data when PR is deleted" do
          payload = {
            action: "deleted",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_url).to be_nil
          expect(line_item.github_pr_number).to be_nil
          expect(line_item.github_pr_title).to be_nil
          expect(line_item.github_pr_state).to be_nil
        end

        it "ignores untracked actions like assigned" do
          original_title = line_item.github_pr_title
          original_author = line_item.github_pr_author

          payload = {
            action: "assigned",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: original_title,
              state: "open",
              draft: false,
              merged_at: nil,
              user: { login: original_author },
              labels: [],
              assignee: { login: "newassignee" },
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          # Line item should not be updated for "assigned" action
          line_item.reload
          expect(line_item.github_pr_title).to eq(original_title)
          expect(line_item.github_pr_author).to eq(original_author)
        end

        it "updates title when PR is edited" do
          original_title = line_item.github_pr_title

          payload = {
            action: "edited",
            pull_request: {
              html_url: "https://github.com/antiwork/flexile/pull/123",
              number: 123,
              title: "Updated PR title",
              state: "open",
              draft: false,
              merged_at: nil,
              user: { login: "contributor" },
              labels: [],
            },
            repository: { full_name: "antiwork/flexile" },
            changes: {
              title: {
                from: original_title,
              },
            },
          }

          send_webhook("pull_request", payload)

          expect(response).to have_http_status(:ok)

          line_item.reload
          expect(line_item.github_pr_title).to eq("Updated PR title")
        end
      end

      describe "installation event" do
        let!(:company) { create(:company, github_org_name: "test-org", github_org_id: 12345) }

        it "clears company GitHub connection when app is deleted" do
          payload = {
            action: "deleted",
            installation: {
              id: 999,
              account: { login: "test-org", id: 12345 },
            },
          }

          send_webhook("installation", payload)

          expect(response).to have_http_status(:ok)

          company.reload
          expect(company.github_org_name).to be_nil
          expect(company.github_org_id).to be_nil
        end

        it "clears company GitHub connection when app is suspended" do
          payload = {
            action: "suspend",
            installation: {
              id: 999,
              account: { login: "test-org", id: 12345 },
            },
          }

          send_webhook("installation", payload)

          expect(response).to have_http_status(:ok)

          company.reload
          expect(company.github_org_name).to be_nil
          expect(company.github_org_id).to be_nil
        end

        it "does not affect company when different org uninstalls" do
          payload = {
            action: "deleted",
            installation: {
              id: 999,
              account: { login: "other-org", id: 99999 },
            },
          }

          send_webhook("installation", payload)

          expect(response).to have_http_status(:ok)

          company.reload
          expect(company.github_org_name).to eq("test-org")
          expect(company.github_org_id).to eq(12345)
        end
      end

      describe "issues event" do
        let(:company) { create(:company, github_org_name: "antiwork") }
        let(:contractor) { create(:user) }
        let!(:company_contractor) { create(:company_contractor, company: company, user: contractor) }
        let!(:invoice) { create(:invoice, company_contractor: company_contractor) }
        let!(:line_item) do
          invoice.invoice_line_items.first.update!(
            github_pr_url: "https://github.com/antiwork/flexile/pull/123",
            github_pr_number: 123,
            github_pr_repo: "antiwork/flexile",
            github_pr_title: "Feature",
            github_pr_state: "open",
            github_pr_author: "contributor"
          )
          invoice.invoice_line_items.first
        end

        it "triggers bounty refresh when issue is labeled" do
          # Mock the GitHub API call that would happen during bounty refresh
          allow(GithubService).to receive(:fetch_pr_details_from_url_with_app).and_return(nil)

          payload = {
            action: "labeled",
            issue: {
              number: 456,
              title: "Bug fix needed",
              labels: [{ name: "$250" }],
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("issues", payload)

          expect(response).to have_http_status(:ok)
        end

        it "ignores non-label actions" do
          payload = {
            action: "opened",
            issue: {
              number: 456,
              title: "New issue",
            },
            repository: { full_name: "antiwork/flexile" },
          }

          send_webhook("issues", payload)

          expect(response).to have_http_status(:ok)
        end
      end

      describe "unknown event" do
        it "responds with ok but ignores the event" do
          send_webhook("unknown_event", { some: "data" })

          expect(response).to have_http_status(:ok)
        end
      end
    end

    context "with invalid JSON payload" do
      it "returns bad request" do
        payload = "not valid json"
        request.headers["HTTP_X_HUB_SIGNATURE_256"] = generate_signature(payload)
        request.headers["HTTP_X_GITHUB_EVENT"] = "ping"
        request.headers["CONTENT_TYPE"] = "application/json"

        post :create, body: payload

        expect(response).to have_http_status(:bad_request)
      end
    end
  end
end
