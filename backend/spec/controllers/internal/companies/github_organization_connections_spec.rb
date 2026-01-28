# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Internal::CompanyGithubConnections", type: :request do
  before do
    # Stub ENV to allow calls to pass through except for specific keys
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("GH_CLIENT_ID").and_return("mock-gh-client-id")
    allow(ENV).to receive(:[]).with("GH_CLIENT_SECRET").and_return("mock-gh-client-secret")
    allow(ENV).to receive(:[]).with("PROTOCOL").and_return("http")
    allow(ENV).to receive(:[]).with("DOMAIN").and_return("localhost:3100")
    allow(ENV).to receive(:[]).with("APP_DOMAIN").and_return("localhost:3100")
    allow(ENV).to receive(:[]).with("API_DOMAIN").and_return("localhost:3101")
    allow(JwtService).to receive(:generate_oauth_state).and_return("mock_signed_state")
    allow(JwtService).to receive(:decode_oauth_state).with("mock_signed_state").and_return({ user_id: admin_user.id })
  end
  let(:company) { create(:company) }

  let(:admin_user) do
    user = create(:user)
    create(:company_administrator, user:, company:)
    user
  end

  let(:non_admin_user) do
    user = create(:user)
    create(:company_worker, user:, company:)
    user
  end

  let(:admin_jwt)     { JwtService.generate_token(admin_user) }
  let(:non_admin_jwt) { JwtService.generate_token(non_admin_user) }

  let(:headers_for_admin) do
    { "x-flexile-auth" => "Bearer #{admin_jwt}" }
  end

  let(:headers_for_non_admin) do
    { "x-flexile-auth" => "Bearer #{non_admin_jwt}" }
  end

  let(:params) do
    {
      github_org_id: "987654",
      github_org_login: "flexile-org",
      installation_id: "inst_123456",
    }
  end

  describe "POST /internal/github_organization_connection/start" do
    it "returns a github app installation url" do
      allow(ENV).to receive(:[]).with("GH_APP_SLUG").and_return("flexile-app")
      post "/internal/github_organization_connection/start",
           params: { redirect_url: "#{PROTOCOL}://#{DOMAIN}/callback" },
           headers: headers_for_admin
      expect(response).to have_http_status(:ok)
      json_response = JSON.parse(response.body)
      expect(json_response["url"]).to include("github.com/apps/flexile-app/installations/new")
      expect(json_response["url"]).to include("state=mock_signed_state")
    end
  end

  describe "GET /internal/github_organization_connection/callback" do
    let(:state) { "secure_state" }
    let(:code) { "auth_code" }
    let(:github_user) { double("GithubUser", login: "org-admin") }

    before do
      allow(Octokit).to receive(:exchange_code_for_token).and_return({ access_token: "token" })
      allow(Octokit::Client).to receive(:new).and_return(double(user: github_user))
    end

    it "exchanges code for token and redirects to frontend without auth headers" do
      app_service = instance_double(GithubAppService)
      allow(GithubAppService).to receive(:new).and_return(app_service)
      allow(app_service).to receive(:fetch_installation_details).with("install-999").and_return({
        account: { id: 12345, login: "mock-org" },
      })

      get "/internal/github_organization_connection/callback",
          params: { state: "mock_signed_state", installation_id: "install-999" }

      expect(response).to have_http_status(:redirect)
      expect(response).to redirect_to("#{PROTOCOL}://#{DOMAIN}/settings/administrator/integrations?github_org=success")

      connection = CompanyGithubConnection.last
      expect(connection.github_org_login).to eq("mock-org")
      expect(connection.installation_id).to eq("install-999")
    end

    it "redirects to custom redirect_url if cookie is present" do
      cookies[:github_oauth_redirect_url] = "#{PROTOCOL}://#{DOMAIN}/custom-integrations"

      app_service = instance_double(GithubAppService)
      allow(GithubAppService).to receive(:new).and_return(app_service)
      allow(app_service).to receive(:fetch_installation_details).and_return({
        account: { id: 12345, login: "mock-org" },
      })

      get "/internal/github_organization_connection/callback",
          params: { state: "mock_signed_state", installation_id: "install-999" }

      expect(response).to redirect_to("#{PROTOCOL}://#{DOMAIN}/custom-integrations?github_org=success")
    end

    it "redirects to error page on failure" do
      allow(GithubAppService).to receive(:new).and_raise(StandardError.new("API Error"))

      get "/internal/github_organization_connection/callback",
          params: { state: "mock_signed_state", installation_id: "fail-999" }

      expect(response).to redirect_to("#{PROTOCOL}://#{DOMAIN}/settings/administrator/integrations?github_org=error")
    end
  end

  describe "POST /internal/github_organization_connection" do
    context "when authenticated company admin" do
      it "connects a GitHub org to the company" do
        expect do
          post "/internal/github_organization_connection",
               params:,
               headers: headers_for_admin
        end.to change { CompanyGithubConnection.count }.by(1)

        expect(response).to have_http_status(:ok)

        record = CompanyGithubConnection.last
        expect(record.company).to eq(company)
        expect(record.github_org_id).to eq("987654")
        expect(record.github_org_login).to eq("flexile-org")
        expect(record.connected_by).to eq(admin_user)
        expect(record.revoked_at).to be_nil
      end
    end

    context "when authenticated but not company admin" do
      it "returns 403 and does not create a connection" do
        expect do
          post "/internal/github_organization_connection",
               params:,
               headers: headers_for_non_admin
        end.not_to change { CompanyGithubConnection.count }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when not authenticated" do
      it "returns 401" do
        post "/internal/github_organization_connection"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when org is already connected to another company" do
      let(:other_company) { create(:company) }

      before do
        create(
          :company_github_connection,
          company: other_company,
          github_org_id: "987654",
          installation_id: "123456",
          revoked_at: nil
        )
      end

      it "returns 422 and does not create a new connection" do
        expect do
          post "/internal/github_organization_connection",
               params:,
               headers: headers_for_admin
        end.not_to change { CompanyGithubConnection.count }

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "when company already has a connected org" do
      before do
        create(
          :company_github_connection,
          company:,
          github_org_id: "111111",
          installation_id: "999999",
          revoked_at: nil
        )
      end

      it "returns 422" do
        post "/internal/github_organization_connection",
             params:,
             headers: headers_for_admin

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "DELETE /internal/github_organization_connection" do
    let!(:connection) do
      create(
        :company_github_connection,
        company:,
        github_org_id: "987654",
        installation_id: "123456",
        revoked_at: nil
      )
    end

    context "when authenticated company admin" do
      it "disconnects the GitHub org and uninstalls the app" do
        app_service = instance_double(GithubAppService)
        allow(GithubAppService).to receive(:new).and_return(app_service)
        expect(app_service).to receive(:delete_installation).with("123456").and_return(true)

        delete "/internal/github_organization_connection",
               headers: headers_for_admin

        expect(response).to have_http_status(:ok)

        connection.reload
        expect(connection.revoked_at).to be_present
      end

      it "disconnects even if uninstallation fails" do
        app_service = instance_double(GithubAppService)
        allow(GithubAppService).to receive(:new).and_return(app_service)
        allow(app_service).to receive(:delete_installation).and_raise(StandardError.new("GitHub error"))

        delete "/internal/github_organization_connection",
               headers: headers_for_admin

        expect(response).to have_http_status(:ok)

        connection.reload
        expect(connection.revoked_at).to be_present
      end
    end

    context "when authenticated but not company admin" do
      it "returns 403 and does not revoke" do
        delete "/internal/github_organization_connection",
               headers: headers_for_non_admin

        expect(response).to have_http_status(:forbidden)

        connection.reload
        expect(connection.revoked_at).to be_nil
      end
    end

    context "when not authenticated" do
      it "returns 401" do
        delete "/internal/github_organization_connection"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when no active connection exists" do
      before { connection.update!(revoked_at: Time.current) }

      it "returns 404" do
        delete "/internal/github_organization_connection",
               headers: headers_for_admin

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
