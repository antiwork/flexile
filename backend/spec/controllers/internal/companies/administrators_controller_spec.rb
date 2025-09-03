# frozen_string_literal: true

RSpec.describe Internal::Companies::AdministratorsController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:email) { "newadmin@example.com" }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "POST #create" do
    context "when user is authorized" do
      context "with valid email" do
        it "creates a new administrator successfully" do
          expect do
            post :create, params: { company_id: company.external_id, email: email }
          end.to have_enqueued_mail(CompanyAdministratorMailer, :invitation_instructions)

          expect(response).to have_http_status(:created)
        end

        it "calls InviteAdmin service with correct parameters" do
          expect(InviteAdmin).to receive(:new).with(
            company: company,
            email: email,
            current_user: admin_user
          ).and_return(double(perform: { success: true }))

          post :create, params: { company_id: company.external_id, email: email }
        end

        context "when InviteAdmin succeeds" do
          it "returns created status" do
            allow_any_instance_of(InviteAdmin).to receive(:perform).and_return({ success: true })

            post :create, params: { company_id: company.external_id, email: email }

            expect(response).to have_http_status(:created)
          end
        end

        context "when InviteAdmin fails" do
          it "returns unprocessable entity status with error details" do
            allow_any_instance_of(InviteAdmin).to receive(:perform).and_return({
              success: false,
              field: "email",
              error_message: "User is already an administrator for this company.",
            })

            post :create, params: { company_id: company.external_id, email: email }

            expect(response).to have_http_status(:unprocessable_entity)

            json_response = response.parsed_body
            expect(json_response["success"]).to be false
            expect(json_response["field"]).to eq("email")
            expect(json_response["error_message"]).to eq("User is already an administrator for this company.")
          end
        end
      end

      context "with missing email parameter" do
        it "returns unprocessable entity status" do
          allow_any_instance_of(InviteAdmin).to receive(:perform).and_return({
            success: false,
            field: "email",
            error_message: "Email can't be blank",
          })

          post :create, params: { company_id: company.external_id }

          expect(response).to have_http_status(:unprocessable_entity)

          json_response = response.parsed_body
          expect(json_response["success"]).to be false
          expect(json_response["field"]).to eq("email")
        end
      end

      context "with empty email parameter" do
        it "returns unprocessable entity status" do
          allow_any_instance_of(InviteAdmin).to receive(:perform).and_return({
            success: false,
            field: "email",
            error_message: "Email can't be blank",
          })

          post :create, params: { company_id: company.external_id, email: "" }

          expect(response).to have_http_status(:unprocessable_entity)

          json_response = response.parsed_body
          expect(json_response["success"]).to be false
          expect(json_response["field"]).to eq("email")
        end
      end
    end

    context "when user is not a company administrator" do
      before { company_administrator.destroy! }

      it "disallows access" do
        post :create, params: { company_id: company.external_id, email: }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
