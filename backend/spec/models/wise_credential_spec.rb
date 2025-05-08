# frozen_string_literal: true

RSpec.describe WiseCredential do
  describe "validations" do
    it { is_expected.to validate_presence_of(:profile_id) }
    it { is_expected.to validate_presence_of(:api_key) }
  end

  describe "callbacks" do
    describe "#delete_outdated_records!" do
      it "deletes all older records for that profile ID", :freeze_time do
        credential = create(:wise_credential, profile_id: WISE_PROFILE_ID)
        deleted_credential = create(:wise_credential, profile_id: WISE_PROFILE_ID, deleted_at: 1.week.ago)
        other_credential = create(:wise_credential, profile_id: "another-profile-id")

        expect do
          create(:wise_credential, profile_id: WISE_PROFILE_ID)
        end.to change { credential.reload.deleted_at }.from(nil).to(Time.current)
           .and not_change { deleted_credential.reload.deleted_at }
           .and not_change { other_credential.reload.deleted_at }
      end
    end
  end

  describe ".flexile_credential" do
    it "returns the live credential with the Wise profile ID" do
      credential = create(:wise_credential, profile_id: WISE_PROFILE_ID)
      create(:wise_credential, profile_id: WISE_PROFILE_ID, deleted_at: Time.current)
      create(:wise_credential, profile_id: "another-profile-id")

      expect(described_class.flexile_credential).to eq credential
    end

    it "raises an error if there are multiple live credentials with the Wise profile ID" do
      create_list(:wise_credential, 2, profile_id: WISE_PROFILE_ID)
        .each(&:reload).each(&:mark_undeleted) # roll back record deletion callback

      expect do
        described_class.flexile_credential
      end.to raise_error ActiveRecord::SoleRecordExceeded
    end
  end
end
