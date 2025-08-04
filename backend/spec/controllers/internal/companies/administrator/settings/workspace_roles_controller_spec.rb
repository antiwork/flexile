# frozen_string_literal: true

RSpec.describe Internal::Companies::Administrator::Settings::WorkspaceRolesController, type: :controller do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:regular_user) { create(:user) }
  let(:invite_admin_service_double) { double("InviteAdministrator") }
  let(:invite_lawyer_service_double) { double("InviteLawyer") }

  before do
    Current.reset
    create(:company_administrator, user: admin_user, company: company)
    @request.env["devise.mapping"] = Devise.mappings[:user]
    allow(InviteAdministrator).to receive(:new).and_return(invite_admin_service_double)
    allow(InviteLawyer).to receive(:new).and_return(invite_lawyer_service_double)
  end

  describe "POST #create" do
    context "when authenticated as company administrator" do
      before do
        current_context = CurrentContext.new(user: admin_user, company: company)
        allow(controller).to receive(:current_context).and_return(current_context)
        allow(Current).to receive(:user).and_return(admin_user)
        allow(Current).to receive(:company).and_return(company)
      end

      context "with valid admin role invitation" do
        let(:valid_params) do
          {
            company_id: company.external_id,
            email: "new.admin@example.com",
            role: "admin",
          }
        end

        let(:successful_service_response) do
          {
            success: true,
            message: "Member invited successfully",
          }
        end

        before do
          allow(invite_admin_service_double).to receive(:perform).and_return(successful_service_response)
        end

        it "returns 201 created status with success response" do
          post :create, params: valid_params
          expect(response).to have_http_status(:created)
        end

        it "returns JSON response with correct success format" do
          post :create, params: valid_params

          response_data = JSON.parse(response.body)
          expect(response_data).to include(
            "success" => true,
            "message" => "Member invited successfully"
          )
        end

        it "delegates to InviteAdministrator service with correct parameters" do
          post :create, params: valid_params

          expect(InviteAdministrator).to have_received(:new).with(
            company: company,
            email: "new.admin@example.com",
            current_user: admin_user
          )
          expect(invite_admin_service_double).to have_received(:perform)
        end
      end

      context "with valid lawyer role invitation" do
        let(:valid_params) do
          {
            company_id: company.external_id,
            email: "new.lawyer@example.com",
            role: "lawyer",
          }
        end

        let(:successful_service_response) do
          {
            success: true,
            message: "Member invited successfully",
          }
        end

        before do
          allow(invite_lawyer_service_double).to receive(:perform).and_return(successful_service_response)
        end

        it "delegates to InviteLawyer service with correct parameters" do
          post :create, params: valid_params

          expect(InviteLawyer).to have_received(:new).with(
            company: company,
            email: "new.lawyer@example.com",
            current_user: admin_user
          )
          expect(invite_lawyer_service_double).to have_received(:perform)
        end
      end

      # Input validation tests (controller responsibility)
      context "with invalid email format" do
        let(:invalid_params) do
          {
            company_id: company.external_id,
            email: "invalid-email-format",
            role: "admin",
          }
        end

        it "returns 422 unprocessable entity status for invalid email" do
          post :create, params: invalid_params
          expect(response).to have_http_status(:unprocessable_entity)
        end

        it "does not call invite services when email validation fails" do
          expect(InviteAdministrator).not_to receive(:new)
          expect(InviteLawyer).not_to receive(:new)
          post :create, params: invalid_params
        end
      end

      context "with missing email" do
        let(:params_without_email) do
          {
            company_id: company.external_id,
            role: "admin",
          }
        end

        it "returns 422 unprocessable entity status for missing email" do
          post :create, params: params_without_email
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      context "with missing role" do
        let(:params_without_role) do
          {
            company_id: company.external_id,
            email: "test@example.com",
          }
        end

        it "returns 422 unprocessable entity status for missing role" do
          post :create, params: params_without_role
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      context "with invalid role" do
        let(:invalid_role_params) do
          {
            company_id: company.external_id,
            email: "test@example.com",
            role: "invalid_role",
          }
        end

        it "returns 403 forbidden status for invalid role" do
          post :create, params: invalid_role_params
          expect(response).to have_http_status(:forbidden)
        end

        it "does not call invite services when role validation fails" do
          expect(InviteAdministrator).not_to receive(:new)
          expect(InviteLawyer).not_to receive(:new)
          post :create, params: invalid_role_params
        end
      end

      context "when trying to invite self" do
        let(:self_invite_params) do
          {
            company_id: company.external_id,
            email: admin_user.email,
            role: "admin",
          }
        end

        it "returns 422 unprocessable entity status when trying to invite self" do
          post :create, params: self_invite_params
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      context "when service returns failure" do
        let(:valid_params) do
          {
            company_id: company.external_id,
            email: "existing@example.com",
            role: "admin",
          }
        end

        let(:failed_service_response) do
          {
            success: false,
            field: "email",
            error_message: "Email has already been taken",
          }
        end

        before do
          allow(invite_admin_service_double).to receive(:perform).and_return(failed_service_response)
        end

        it "returns 422 unprocessable entity status when service fails" do
          post :create, params: valid_params
          expect(response).to have_http_status(:unprocessable_entity)
        end

        it "returns JSON response with service error details" do
          post :create, params: valid_params

          response_data = JSON.parse(response.body)
          expect(response_data).to include(
            "success" => false,
            "field" => "email",
            "error" => "Email has already been taken"
          )
        end
      end
    end

    context "when authenticated as regular user without admin privileges" do
      before do
        current_context = CurrentContext.new(user: regular_user, company: company)
        allow(controller).to receive(:current_context).and_return(current_context)
        allow(Current).to receive(:user).and_return(regular_user)
        allow(Current).to receive(:company).and_return(company)
      end

      it "returns 403 forbidden status for unauthorized access" do
        post :create, params: {
          company_id: company.external_id,
          email: "test@example.com",
          role: "admin",
        }
        expect(response).to have_http_status(:forbidden)
      end

      it "does not call invite services when unauthorized" do
        expect(InviteAdministrator).not_to receive(:new)
        expect(InviteLawyer).not_to receive(:new)

        post :create, params: {
          company_id: company.external_id,
          email: "test@example.com",
          role: "admin",
        }
      end
    end

    context "when no user is authenticated" do
      before do
        current_context = CurrentContext.new(user: nil, company: company)
        allow(controller).to receive(:current_context).and_return(current_context)
        allow(Current).to receive(:user).and_return(nil)
        allow(Current).to receive(:company).and_return(company)
      end

      it "returns 403 forbidden status for unauthenticated requests" do
        post :create, params: {
          company_id: company.external_id,
          email: "test@example.com",
          role: "admin",
        }
        expect(response).to have_http_status(:forbidden)
      end

      it "does not call invite services when unauthenticated" do
        expect(InviteAdministrator).not_to receive(:new)
        expect(InviteLawyer).not_to receive(:new)

        post :create, params: {
          company_id: company.external_id,
          email: "test@example.com",
          role: "admin",
        }
      end
    end
  end
end
