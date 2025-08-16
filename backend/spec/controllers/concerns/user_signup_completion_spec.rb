# frozen_string_literal: true

RSpec.describe UserSignupCompletion do
  controller(ApplicationController) do
    include UserSignupCompletion

    def test_complete_user_signup
      user = User.find(params[:user_id])
      result = complete_user_signup(user)
      render json: { completed: true, user_id: result.id }
    end
  end

  let(:remote_ip) { "192.168.1.1" }

  before do
    routes.draw do
      post "test_complete_user_signup" => "anonymous#test_complete_user_signup"
    end
  end

  before(:each) do
    allow_any_instance_of(ActionDispatch::Request).to receive(:remote_ip).and_return(remote_ip)
  end

  describe "#complete_user_signup" do
    context "with new user" do
      let!(:new_user) { create(:user, email: "newuser@example.com", confirmed_at: nil, current_sign_in_at: nil, invitation_accepted_at: nil) }

      it "completes user signup with all required fields" do
        expect do
          post :test_complete_user_signup, params: { user_id: new_user.id }
        end.to change(TosAgreement, :count).by(1)

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["completed"]).to be true

        new_user.reload
        expect(new_user.confirmed_at).to be_present
        expect(new_user.current_sign_in_at).to be_present
        expect(new_user.invitation_accepted_at).to be_present

        tos_agreement = new_user.tos_agreements.first
        expect(tos_agreement.ip_address).to eq(remote_ip)
      end

      it "sets timestamps to current time" do
        freeze_time do
          post :test_complete_user_signup, params: { user_id: new_user.id }

          new_user.reload
          expect(new_user.confirmed_at).to eq(Time.current)
          expect(new_user.current_sign_in_at).to eq(Time.current)
          expect(new_user.invitation_accepted_at).to eq(Time.current)
        end
      end

      it "performs all operations within a transaction" do
        allow_any_instance_of(User).to receive(:save!).and_raise(ActiveRecord::RecordInvalid, new_user)

        expect do
          expect do
            post :test_complete_user_signup, params: { user_id: new_user.id }
          end.to raise_error(ActiveRecord::RecordInvalid)
        end.not_to change(TosAgreement, :count)
      end
    end

    context "with existing user" do
      let!(:existing_user) { create(:user, email: "existing@example.com") }

      it "updates existing user with signup completion fields" do
        original_confirmed_at = existing_user.confirmed_at
        original_current_sign_in_at = existing_user.current_sign_in_at
        original_invitation_accepted_at = existing_user.invitation_accepted_at

        expect do
          post :test_complete_user_signup, params: { user_id: existing_user.id }
        end.to change(TosAgreement, :count).by(1)

        expect(response).to have_http_status(:ok)

        existing_user.reload
        expect(existing_user.confirmed_at).not_to eq(original_confirmed_at)
        expect(existing_user.current_sign_in_at).not_to eq(original_current_sign_in_at)
        expect(existing_user.invitation_accepted_at).not_to eq(original_invitation_accepted_at)

        tos_agreement = existing_user.tos_agreements.last
        expect(tos_agreement.ip_address).to eq(remote_ip)
      end

      it "updates timestamps to current time" do
        freeze_time do
          post :test_complete_user_signup, params: { user_id: existing_user.id }

          existing_user.reload
          expect(existing_user.confirmed_at).to eq(Time.current)
          expect(existing_user.current_sign_in_at).to eq(Time.current)
          expect(existing_user.invitation_accepted_at).to eq(Time.current)
        end
      end

      it "creates a new TOS agreement even for existing users" do
        existing_tos_count = existing_user.tos_agreements.count

        post :test_complete_user_signup, params: { user_id: existing_user.id }

        expect(existing_user.tos_agreements.count).to eq(existing_tos_count + 1)
      end
    end
  end
end
