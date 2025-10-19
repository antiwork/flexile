# frozen_string_literal: true

RSpec.describe ImpersonationService do
  let(:team_member) { create(:user, team_member: true) }
  let(:user) { create(:user) }

  describe "#impersonate" do
    it "sets or updates the impersonated user in Redis" do
      service = described_class.new(team_member)
      another_user = create(:user)

      service.impersonate(user)

      stored_id = $redis.get(RedisKey.impersonated_user(team_member.id))
      expect(stored_id).to eq(user.id.to_s)
      expect(service.impersonated_user).to eq(user)

      service.impersonate(another_user)

      stored_id = $redis.get(RedisKey.impersonated_user(team_member.id))
      expect(stored_id).to eq(another_user.id.to_s)
      expect(service.impersonated_user).to eq(another_user)
    end
  end

  describe "#unimpersonate" do
    it "clears impersonation data from Redis" do
      service = described_class.new(team_member)

      service.impersonate(user)
      service.unimpersonate

      stored_id = $redis.get(RedisKey.impersonated_user(team_member.id))
      expect(stored_id).to be_nil
      expect(service.impersonated_user).to be_nil
    end
  end

  describe "#impersonated_user" do
    it "returns impersonated user when team member is impersonating" do
      service = described_class.new(team_member)

      service.impersonate(user)

      expect(service.impersonated_user).to eq(user)
    end

    it "returns nil when impersonation is not active or becomes invalid" do
      service = described_class.new(team_member)

      # not impersonating
      expect(service.impersonated_user).to be_nil

      # user deleted
      service.impersonate(user)
      user.destroy
      expect(service.impersonated_user).to be_nil

      # team member loses permission
      team_member.update!(team_member: false)
      expect(service.impersonated_user).to be_nil

      # impersonated user becomes team member
      user_becoming_team_member = create(:user)
      service = described_class.new(team_member)
      service.impersonate(user_becoming_team_member)
      user_becoming_team_member.update!(team_member: true)
      expect(service.impersonated_user).to be_nil
    end

    it "never checks Redis for non-team members" do
      non_team_member = create(:user)
      service = described_class.new(non_team_member)

      expect($redis).not_to receive(:get)
      expect(service.impersonated_user).to be_nil
    end
  end
end
