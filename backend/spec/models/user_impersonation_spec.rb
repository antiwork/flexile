# frozen_string_literal: true

RSpec.describe User, "impersonation methods" do
  let(:admin_user) { create(:user, team_member: true) }
  let(:regular_user) { create(:user, team_member: false) }
  let(:target_user) { create(:user) }

  describe "#team_member?" do
    it "returns true for admin users" do
      expect(admin_user.team_member?).to be true
    end

    it "returns false for regular users" do
      expect(regular_user.team_member?).to be false
    end

    it "returns false for newly created users by default" do
      new_user = create(:user)
      expect(new_user.team_member?).to be false
    end
  end

  describe "impersonation security" do
    it "handles team_member boolean values correctly" do
      admin_user = create(:user, team_member: true)
      regular_user = create(:user, team_member: false)

      expect(admin_user.team_member?).to be_truthy
      expect(regular_user.team_member?).to be_falsey
    end
  end

  describe "user attributes for impersonation" do
    it "preserves all user attributes needed for impersonation" do
      user = create(:user,
                    legal_name: "John Michael Doe",
                    preferred_name: "Johnny",
                    email: "john.doe@example.com")

      expect(user.name).to eq("Johnny") # preferred_name takes precedence
      expect(user.legal_name).to eq("John Michael Doe")
      expect(user.preferred_name).to eq("Johnny")
      expect(user.email).to eq("john.doe@example.com")
    end

    it "handles users with minimal data" do
      minimal_user = create(:user, email: "minimal@example.com", legal_name: "Minimal User")

      expect(minimal_user.email).to be_present
      expect(minimal_user.name).to be_present
      expect(minimal_user.legal_name).to be_present
    end

    it "handles users with empty preferred_name" do
      user = create(:user, legal_name: "John Doe")
      user.update_column(:preferred_name, nil) # Force preferred_name to nil after factory creation

      expect(user.name).to eq("John Doe") # falls back to legal_name
      expect(user.legal_name).to eq("John Doe")
      expect(user.preferred_name).to be_nil
    end
  end

  describe "email lookup for impersonation" do
    let(:target_user) { create(:user, email: "target@example.com") }
    let!(:user_with_special_email) { create(:user, email: "test+special@example.com") }
    let!(:user_with_dots) { create(:user, email: "first.last@example.com") }

    it "finds users by exact email match" do
      found_user = User.find_by(email: target_user.email)
      expect(found_user).to eq(target_user)

      # Test that non-matching case returns nil (Rails default behavior)
      found_user_different_case = User.find_by(email: target_user.email.upcase)
      expect(found_user_different_case).to be_nil
    end

    it "handles emails with special characters" do
      found_user = User.find_by(email: "test+special@example.com")
      expect(found_user).to eq(user_with_special_email)
    end

    it "handles emails with dots" do
      found_user = User.find_by(email: "first.last@example.com")
      expect(found_user).to eq(user_with_dots)
    end

    it "handles case sensitivity in email lookup" do
      # Test exact match works
      found_user = User.find_by(email: target_user.email)
      expect(found_user).to eq(target_user)

      # Test that Rails default behavior is case-sensitive
      found_user_upper = User.find_by(email: target_user.email.upcase)
      expect(found_user_upper).to be_nil
    end

    it "returns nil for non-existent emails" do
      found_user = User.find_by(email: "nonexistent@example.com")
      expect(found_user).to be_nil
    end

    it "handles empty email lookup" do
      found_user = User.find_by(email: "")
      expect(found_user).to be_nil
    end

    it "handles nil email lookup" do
      found_user = User.find_by(email: nil)
      expect(found_user).to be_nil
    end
  end

  describe "user state consistency" do
    it "maintains consistent state after updates" do
      user = create(:user, legal_name: "Original Name", team_member: false)
      original_id = user.id

      user.update!(preferred_name: "Updated Preferred")
      user.reload

      expect(user.id).to eq(original_id)
      expect(user.name).to eq("Updated Preferred")
      expect(user.team_member?).to be_falsey
    end

    it "handles concurrent access scenarios" do
      user = create(:user)
      original_email = user.email

      # Simulate concurrent access
      user_copy = User.find(user.id)
      expect(user_copy.email).to eq(original_email)
      expect(user_copy.id).to eq(user.id)
    end
  end
end
