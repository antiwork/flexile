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
  end

  describe "POST #connect" do
    context "when user is authorized" do
      it "connects GitHub organization to company" do
        post :connect, params: {
          company_id: company.external_id,
          github_org_name: "antiwork",
          github_org_id: 12345,
        }

        expect(response).to have_http_status(:ok)

        json_response = response.parsed_body
        expect(json_response["success"]).to be true
        expect(json_response["github_org_name"]).to eq("antiwork")

        company.reload
        expect(company.github_org_name).to eq("antiwork")
        expect(company.github_org_id).to eq(12345)
      end

      it "returns error when github_org_name is missing" do
        post :connect, params: {
          company_id: company.external_id,
          github_org_id: 12345,
        }

        expect(response).to have_http_status(:bad_request)

        json_response = response.parsed_body
        expect(json_response["error"]).to eq("GitHub organization name is required")
      end

      it "returns error when github_org_name is blank" do
        post :connect, params: {
          company_id: company.external_id,
          github_org_name: "",
          github_org_id: 12345,
        }

        expect(response).to have_http_status(:bad_request)

        json_response = response.parsed_body
        expect(json_response["error"]).to eq("GitHub organization name is required")
      end

      it "allows connecting without github_org_id" do
        post :connect, params: {
          company_id: company.external_id,
          github_org_name: "antiwork",
        }

        expect(response).to have_http_status(:ok)

        company.reload
        expect(company.github_org_name).to eq("antiwork")
        expect(company.github_org_id).to be_nil
      end
    end

    context "when user is not a company administrator" do
      before { company_administrator.destroy! }

      it "disallows access" do
        post :connect, params: {
          company_id: company.external_id,
          github_org_name: "antiwork",
        }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "DELETE #disconnect" do
    before do
      company.update!(github_org_name: "antiwork", github_org_id: 12345)
    end

    context "when user is authorized" do
      it "removes GitHub organization from company" do
        delete :disconnect, params: { company_id: company.external_id }

        expect(response).to have_http_status(:no_content)

        company.reload
        expect(company.github_org_name).to be_nil
        expect(company.github_org_id).to be_nil
      end

      it "succeeds even if no GitHub org is connected" do
        company.update!(github_org_name: nil, github_org_id: nil)

        delete :disconnect, params: { company_id: company.external_id }

        expect(response).to have_http_status(:no_content)
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
