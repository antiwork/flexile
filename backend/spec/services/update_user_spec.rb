# frozen_string_literal: true

RSpec.describe UpdateUser do
  describe "#process" do
    let(:service) { described_class.new(user:, update_params:, confirm_tax_info:) }

    context "when saving the user's legal details" do
      let(:original_compliance_info) { create(:user_compliance_info, :without_legal_details) }
      let(:user) { original_compliance_info.user }
      let(:update_params) do
        ActionController::Parameters.new(
          {
            street_address: "31 Street",
            city: "New York",
            state: "NY",
            zip_code: "10004",
            business_entity: "0",
          }
        ).permit!
      end

      context "when the user has not confirmed their tax info" do
        let(:confirm_tax_info) { false }

        it "saves the user's legal details" do
          expect do
            expect(service.process).to be_nil
          end.to change { user.reload.user_compliance_infos.count }.by(1)

          expect(user.compliance_info).not_to eq(original_compliance_info)
          expect(original_compliance_info.reload).to be_deleted

          expect(user.street_address).to eq("31 Street")
          expect(user.city).to eq("New York")
          expect(user.state).to eq("NY")
          expect(user.zip_code).to eq("10004")
          expect(user.business_entity).to eq(false)
          expect(user.tax_information_confirmed_at).to be_nil
        end

        it "returns errors on failure" do
          # Simulate a failing validation
          allow(user).to receive(:save!) { user.errors.add(:city, "cannot be XYZ"); raise ActiveRecord::RecordInvalid }

          expect do
            expect(service.process).to eq("City cannot be XYZ")
          end.to_not change { user.reload.user_compliance_infos.count }
        end
      end

      context "when the user has confirmed their tax info" do
        let(:confirm_tax_info) { true }
        let(:update_params) do
          ActionController::Parameters.new(
            {
              street_address: "31 Street",
              city: "New York",
              state: "NY",
              zip_code: "10004",
              business_entity: "0",
              tax_id: "123-45-6789",
            }
          ).permit!
        end

        it "saves the user's legal details with compliance info" do
          expect do
            expect(service.process).to be_nil
          end.to change { user.reload.user_compliance_infos.count }.by(1)

          expect(user.street_address).to eq("31 Street")
          expect(user.city).to eq("New York")
          expect(user.state).to eq("NY")
          expect(user.zip_code).to eq("10004")
          expect(user.business_entity).to eq(false)
          expect(user.tax_id).to eq("123456789")
          expect(user.tax_information_confirmed_at).to be_present
        end

        context "when compliance info details are missing" do
          let(:update_params) do
            ActionController::Parameters.new(
              {
                street_address: "31 Street",
                city: "New York",
                state: "NY",
                zip_code: "10004",
                business_entity: "0",
                tax_id: "",
              }
            ).permit!
          end

          it "returns an error message" do
            expect(service.process).to eq("User compliance infos tax can't be blank")
          end
        end

        context "when compliance infos already exist" do
          let(:user) { create(:user) }
          let!(:old_compliance_info) { create(:user_compliance_info, user:) }
          let!(:old_tax_document) { create(:tax_doc, :form_w9, user_compliance_info: old_compliance_info) }

          it "updates the user and creates a new compliance info record" do
            expect do
              expect(service.process).to be_nil
            end.to change { user.reload.user_compliance_infos.count }.by(1)
               .and change { GenerateTaxInformationDocumentJob.jobs.size }.by(1)

            expect(user.compliance_info).to_not eq(old_compliance_info)
            expect(user.street_address).to eq("31 Street")
            expect(user.city).to eq("New York")
            expect(user.state).to eq("NY")
            expect(user.zip_code).to eq("10004")
            expect(user.business_entity).to eq(false)
            expect(user.tax_id).to eq("123456789")
            expect(user.tax_information_confirmed_at).to be_present
            expect(old_compliance_info.reload).to be_deleted
            expect(old_tax_document.reload).to_not be_deleted
          end

          it "does not delete old records if saving fails" do
            allow_any_instance_of(User).to receive(:save!).and_raise(ActiveRecord::RecordInvalid)
            expect do
              expect(service.process).to eq("Error saving information")
            end.to change { user.reload.user_compliance_infos.count }.by(0)
               .and change { GenerateTaxInformationDocumentJob.jobs.size }.by(0)
            expect(old_compliance_info).not_to be_deleted
            expect(old_tax_document).not_to be_deleted

            allow_any_instance_of(UserComplianceInfo).to receive(:save!).and_raise(ActiveRecord::RecordInvalid)
            expect do
              expect(service.process).to eq("Error saving information")
            end.to change { user.reload.user_compliance_infos.count }.by(0)
               .and change { GenerateTaxInformationDocumentJob.jobs.size }.by(0)
            expect(old_compliance_info).not_to be_deleted
            expect(old_tax_document).not_to be_deleted
          end
        end
      end

      context "when the user does not yet have a user_compliance_info record" do # should not happen in practice
        let(:user) { create(:user, :without_compliance_info) }
        let(:confirm_tax_info) { false }

        it "saves the user's legal details" do
          expect do
            expect(service.process).to be_nil
          end.to change { user.reload.user_compliance_infos.count }.by(1)

          expect(user.compliance_info).to be_present

          expect(user.street_address).to eq("31 Street")
          expect(user.city).to eq("New York")
          expect(user.state).to eq("NY")
          expect(user.zip_code).to eq("10004")
          expect(user.business_entity).to eq(false)
          expect(user.tax_information_confirmed_at).to be_nil
        end
      end
    end

    context "when updating the user settings" do
      let(:user) { create(:user) }
      let(:params) do
        {
          preferred_name: "007",
          legal_name: "James Bond",
          password: "password",
          minimum_dividend_payment_in_cents: 800_00,
          signature: "007",
        }
      end
      let(:update_params) { ActionController::Parameters.new(params).permit! }

      context "when the user has not confirmed their tax info" do
        let(:confirm_tax_info) { false }

        it "saves the user's settings" do
          expect do
            expect(service.process).to be_nil
          end.to change { user.reload.user_compliance_infos.count }.by(1)
             .and change { GenerateTaxInformationDocumentJob.jobs.size }.by(0)

          expect(user.preferred_name).to eq("007")
          expect(user.legal_name).to eq("James Bond")
          expect(user.valid_password?("password")).to eq(true)
          expect(user.minimum_dividend_payment_in_cents).to eq(800_00)
          expect(user.tax_information_confirmed_at).to be_nil
        end

        context "when no password is passed as param" do
          before do
            params.delete(:password)
            user.update!(password: "VeryUniquePassword")
          end

          it "skips changing the password" do
            expect do
              expect(service.process).to be_nil
            end.to change { user.reload.user_compliance_infos.count }.by(1)
               .and change { GenerateTaxInformationDocumentJob.jobs.size }.by(0)

            user.reload
            expect(user.valid_password?("VeryUniquePassword")).to eq(true)
          end
        end
      end

      context "when the user has confirmed their tax info" do
        let(:confirm_tax_info) { true }

        it "saves the user's settings with compliance info" do
          expect do
            expect(service.process).to be_nil
          end.to change { user.reload.user_compliance_infos.count }.by(1)
             .and change { GenerateTaxInformationDocumentJob.jobs.size }.from(0).to(1)

          expect(user.preferred_name).to eq("007")
          expect(user.legal_name).to eq("James Bond")
          expect(user.minimum_dividend_payment_in_cents).to eq(800_00)
          expect(user.tax_information_confirmed_at).to be_present
          expect(user.compliance_info.signature).to eq("007")
        end

        context "when compliance infos already exist" do
          let!(:old_compliance_info) { create(:user_compliance_info, user:) }

          it "updates the user and creates a new compliance info record" do
            expect do
              expect(service.process).to be_nil
            end.to change { user.reload.user_compliance_infos.count }.from(2).to(3)
               .and change { GenerateTaxInformationDocumentJob.jobs.size }.from(0).to(1)

            expect(user.compliance_info).to_not eq(old_compliance_info)
            expect(user.preferred_name).to eq("007")
            expect(user.legal_name).to eq("James Bond")
            expect(user.minimum_dividend_payment_in_cents).to eq(800_00)
            expect(user.tax_information_confirmed_at).to be_present
            expect(user.compliance_info.signature).to eq("007")
          end
        end
      end
    end
  end
end
