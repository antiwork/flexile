# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Internal::CompanyGithubConnections", type: :request do
  let(:company) { create(:company) }

  let(:admin_user) do
    user = create(:user)
    create(:company_administrator, user:, company:)
    user
  end

  let(:non_admin_user) { create(:user) }

  let(:admin_jwt)     { JwtService.encode(user_id: admin_user.id) }
  let(:non_admin_jwt) { JwtService.encode(user_id: non_admin_user.id) }

  let(:headers_for_admin) do
    { "Authorization" => "Bearer #{admin_jwt}" }
  end

  let(:headers_for_non_admin) do
    { "Authorization" => "Bearer #{non_admin_jwt}" }
  end

  let(:params) do
    {
      github_org_id: "987654",
      github_org_login: "flexile-org",
    }
  end

  describe "POST /internal/company/github_connection" do
    context "when authenticated company admin" do
      it "connects a GitHub org to the company" do
        expect do
          post "/internal/company/github_connection",
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
          post "/internal/company/github_connection",
               params:,
               headers: headers_for_non_admin
        end.not_to change { CompanyGithubConnection.count }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when not authenticated" do
      it "returns 401" do
        post "/internal/company/github_connection"

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
          revoked_at: nil
        )
      end

      it "returns 422 and does not create a new connection" do
        expect do
          post "/internal/company/github_connection",
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
          revoked_at: nil
        )
      end

      it "returns 422" do
        post "/internal/company/github_connection",
             params:,
             headers: headers_for_admin

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "DELETE /internal/company/github_connection" do
    let!(:connection) do
      create(
        :company_github_connection,
        company:,
        github_org_id: "987654",
        revoked_at: nil
      )
    end

    context "when authenticated company admin" do
      it "disconnects the GitHub org (soft delete)" do
        delete "/internal/company/github_connection",
               headers: headers_for_admin

        expect(response).to have_http_status(:ok)

        connection.reload
        expect(connection.revoked_at).to be_present
      end
    end

    context "when authenticated but not company admin" do
      it "returns 403 and does not revoke" do
        delete "/internal/company/github_connection",
               headers: headers_for_non_admin

        expect(response).to have_http_status(:forbidden)

        connection.reload
        expect(connection.revoked_at).to be_nil
      end
    end

    context "when not authenticated" do
      it "returns 401" do
        delete "/internal/company/github_connection"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when no active connection exists" do
      before { connection.update!(revoked_at: Time.current) }

      it "returns 404" do
        delete "/internal/company/github_connection",
               headers: headers_for_admin

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
