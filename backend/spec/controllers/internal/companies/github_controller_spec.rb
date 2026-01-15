# frozen_string_literal: true

RSpec.describe Internal::Companies::GithubController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end

    allow(GlobalConfig).to receive(:get).and_call_original
    allow(GlobalConfig).to receive(:get).with("GH_APP_ID").and_return(nil)
    allow(GlobalConfig).to receive(:get).with("GH_APP_PRIVATE_KEY").and_return(nil)
  end

  describe "DELETE #disconnect" do
    before do
      company.update!(github_org_name: "antiwork", github_org_id: 12345)
    end

    context "when user is authorized" do
      it "removes GitHub organization from company and returns success" do
        delete :disconnect, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)

        json_response = response.parsed_body
        expect(json_response["success"]).to be true
        expect(json_response["app_uninstalled"]).to be false

        company.reload
        expect(company.github_org_name).to be_nil
        expect(company.github_org_id).to be_nil
      end

      it "succeeds even if no GitHub org is connected" do
        company.update!(github_org_name: nil, github_org_id: nil)

        delete :disconnect, params: { company_id: company.external_id }

        expect(response).to have_http_status(:ok)

        json_response = response.parsed_body
        expect(json_response["success"]).to be true
      end

      context "when GitHub App is configured" do
        let(:webhook_secret) { "test_secret" }

        before do
          allow(GlobalConfig).to receive(:get).with("GH_APP_ID").and_return("123456")
          allow(GlobalConfig).to receive(:get).with("GH_APP_PRIVATE_KEY").and_return(nil)
          allow(GithubService).to receive(:app_configured?).and_return(true)
        end

        it "attempts to uninstall GitHub App when installation exists" do
          allow(GithubService).to receive(:find_installation_by_account)
            .with(account_login: "antiwork")
            .and_return({ id: 999 })
          allow(GithubService).to receive(:delete_installation)
            .with(installation_id: 999)
            .and_return(true)

          delete :disconnect, params: { company_id: company.external_id }

          expect(response).to have_http_status(:ok)

          json_response = response.parsed_body
          expect(json_response["success"]).to be true
          expect(json_response["app_uninstalled"]).to be true

          company.reload
          expect(company.github_org_name).to be_nil
        end

        it "succeeds even if GitHub App uninstall fails" do
          allow(GithubService).to receive(:find_installation_by_account)
            .with(account_login: "antiwork")
            .and_return({ id: 999 })
          allow(GithubService).to receive(:delete_installation)
            .with(installation_id: 999)
            .and_return(false)

          delete :disconnect, params: { company_id: company.external_id }

          expect(response).to have_http_status(:ok)

          json_response = response.parsed_body
          expect(json_response["success"]).to be true
          expect(json_response["app_uninstalled"]).to be false

          company.reload
          expect(company.github_org_name).to be_nil
        end

        it "succeeds when no installation is found" do
          allow(GithubService).to receive(:find_installation_by_account)
            .with(account_login: "antiwork")
            .and_return(nil)

          delete :disconnect, params: { company_id: company.external_id }

          expect(response).to have_http_status(:ok)

          json_response = response.parsed_body
          expect(json_response["success"]).to be true
          expect(json_response["app_uninstalled"]).to be false

          company.reload
          expect(company.github_org_name).to be_nil
        end
      end
    end

    context "when user is not a company administrator" do
      before { company_administrator.destroy! }

      it "disallows access" do
        delete :disconnect, params: { company_id: company.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
