# frozen_string_literal: true

RSpec.describe JwtService do
  let(:user) { create(:user) }

  describe ".generate_token" do
    it "generates a valid JWT token" do
      token = described_class.generate_token(user)

      expect(token).to be_present
      expect(token.split(".").length).to eq(3) # JWT has 3 parts
    end

    it "includes user information in the token payload" do
      token = described_class.generate_token(user)
      decoded_token = JWT.decode(token, described_class.send(:jwt_secret), true, { algorithm: "HS256" })
      payload = decoded_token.first

      expect(payload["user_id"]).to eq(user.id)
      expect(payload["email"]).to eq(user.email)
      expect(payload["exp"]).to be_present
    end

    it "generates different tokens for different users" do
      user2 = create(:user)
      token1 = described_class.generate_token(user)
      token2 = described_class.generate_token(user2)

      expect(token1).not_to eq(token2)
    end

    it "generates different tokens for the same user at different times" do
      token1 = described_class.generate_token(user)
      travel_to(1.minute.from_now) do
        token2 = described_class.generate_token(user)
        expect(token1).not_to eq(token2)
      end
    end
  end

  describe ".user_from_token" do
    it "returns the correct user from a valid token" do
      token = described_class.generate_token(user)
      decoded_user = described_class.user_from_token(token)

      expect(decoded_user).to eq(user)
    end

    it "returns nil for an invalid token" do
      invalid_token = "invalid.token.here"
      decoded_user = described_class.user_from_token(invalid_token)

      expect(decoded_user).to be_nil
    end

    it "returns nil for an expired token" do
      token = described_class.generate_token(user)

      travel_to(2.months.from_now) do # Token expires after 1 month
        decoded_user = described_class.user_from_token(token)
        expect(decoded_user).to be_nil
      end
    end

    it "returns nil for a token with wrong signature" do
      # Generate token with different secret
      payload = { user_id: user.id, email: user.email, exp: 24.hours.from_now.to_i }
      wrong_token = JWT.encode(payload, "wrong_secret", "HS256")

      decoded_user = described_class.user_from_token(wrong_token)
      expect(decoded_user).to be_nil
    end

    it "returns nil when user no longer exists" do
      token = described_class.generate_token(user)
      user.destroy!

      decoded_user = described_class.user_from_token(token)
      expect(decoded_user).to be_nil
    end
  end

  describe ".token_present_in_request?" do
    let(:request) { double("request") }

    it "returns true when valid bearer token is present" do
      allow(request).to receive(:headers).and_return({ "x-flexile-auth" => "Bearer valid_token" })

      expect(described_class.token_present_in_request?(request)).to be true
    end

    it "returns false when no authorization header is present" do
      allow(request).to receive(:headers).and_return({})

      expect(described_class.token_present_in_request?(request)).to be false
    end

    it "returns false when authorization header is empty" do
      allow(request).to receive(:headers).and_return({ "x-flexile-auth" => "" })

      expect(described_class.token_present_in_request?(request)).to be false
    end

    it "returns false when authorization header doesn't start with Bearer" do
      allow(request).to receive(:headers).and_return({ "x-flexile-auth" => "Basic token" })

      expect(described_class.token_present_in_request?(request)).to be false
    end

    it "returns false when authorization header is nil" do
      allow(request).to receive(:headers).and_return({ "x-flexile-auth" => nil })

      expect(described_class.token_present_in_request?(request)).to be false
    end
  end

  describe "impersonation token generation" do
    it "generates tokens that can be used for impersonation" do
      # Generate token for one user
      token = described_class.generate_token(user)

      # Verify it can be used to authenticate as that user
      decoded_user = described_class.user_from_token(token)
      expect(decoded_user).to eq(user)
      expect(decoded_user.email).to eq(user.email)
    end

    it "maintains user identity through token round-trip" do
      original_attributes = {
        id: user.id,
        email: user.email,
        name: user.name,
        legal_name: user.legal_name,
        preferred_name: user.preferred_name,
      }

      token = described_class.generate_token(user)
      decoded_user = described_class.user_from_token(token)

      expect(decoded_user.id).to eq(original_attributes[:id])
      expect(decoded_user.email).to eq(original_attributes[:email])
      expect(decoded_user.name).to eq(original_attributes[:name])
      expect(decoded_user.legal_name).to eq(original_attributes[:legal_name])
      expect(decoded_user.preferred_name).to eq(original_attributes[:preferred_name])
    end
  end
end
