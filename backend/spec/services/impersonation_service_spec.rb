# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ImpersonationService do
  let(:user) { create(:user, email: "test@example.com", without_bank_account: true) }
  let(:admin_user) { create(:user, email: "admin@example.com", team_member: true, without_bank_account: true) }

  describe ".generate_impersonation_url_token" do
    it "generates a valid JWT token" do
      token = ImpersonationService.generate_impersonation_url_token(user)
      
      expect(token).to be_present
      
      # Decode and verify token
      decoded = JWT.decode(token, ImpersonationService.send(:jwt_secret), true, { algorithm: "HS256" })
      payload = decoded[0]
      
      expect(payload["user_id"]).to eq(user.id)
      expect(payload["email"]).to eq(user.email)
      expect(payload["type"]).to eq("impersonation_url")
      expect(payload["exp"]).to be > Time.current.to_i
    end
  end

  describe ".generate_impersonation_session_token" do
    it "generates a valid session token" do
      token = ImpersonationService.generate_impersonation_session_token(user, admin_user)
      
      expect(token).to be_present
      
      # Decode and verify token
      decoded = JWT.decode(token, ImpersonationService.send(:jwt_secret), true, { algorithm: "HS256" })
      payload = decoded[0]
      
      expect(payload["user_id"]).to eq(user.id)
      expect(payload["email"]).to eq(user.email)
      expect(payload["admin_user_id"]).to eq(admin_user.id)
      expect(payload["admin_email"]).to eq(admin_user.email)
      expect(payload["type"]).to eq("impersonation_session")
      expect(payload["exp"]).to be > Time.current.to_i
    end
  end

  describe ".validate_impersonation_url_token" do
    it "validates a valid token" do
      token = ImpersonationService.generate_impersonation_url_token(user)
      
      validated_user = ImpersonationService.validate_impersonation_url_token(token)
      
      expect(validated_user).to eq(user)
    end

    it "returns nil for invalid token" do
      validated_user = ImpersonationService.validate_impersonation_url_token("invalid_token")
      
      expect(validated_user).to be_nil
    end

    it "returns nil for expired token" do
      # Create an expired token by manipulating the expiry
      payload = {
        user_id: user.id,
        email: user.email,
        type: "impersonation_url",
        exp: 1.minute.ago.to_i,
        iat: Time.current.to_i
      }
      expired_token = JWT.encode(payload, ImpersonationService.send(:jwt_secret), "HS256")
      
      validated_user = ImpersonationService.validate_impersonation_url_token(expired_token)
      
      expect(validated_user).to be_nil
    end

    it "returns nil for wrong token type" do
      # Create a session token instead of URL token
      token = ImpersonationService.generate_impersonation_session_token(user, admin_user)
      
      validated_user = ImpersonationService.validate_impersonation_url_token(token)
      
      expect(validated_user).to be_nil
    end
  end

  describe ".validate_impersonation_session_token" do
    it "validates a valid session token" do
      token = ImpersonationService.generate_impersonation_session_token(user, admin_user)
      
      result = ImpersonationService.validate_impersonation_session_token(token)
      
      expect(result).to be_present
      expect(result[:user]).to eq(user)
      expect(result[:admin_user]).to eq(admin_user)
    end

    it "returns nil for invalid token" do
      result = ImpersonationService.validate_impersonation_session_token("invalid_token")
      
      expect(result).to be_nil
    end

    it "returns nil if admin user is not a team member" do
      non_admin = create(:user, team_member: false, without_bank_account: true)
      token = ImpersonationService.generate_impersonation_session_token(user, non_admin)
      
      result = ImpersonationService.validate_impersonation_session_token(token)
      
      expect(result).to be_nil
    end
  end

  describe "request helper methods" do
    let(:request) { double("request") }
    let(:headers) { {} }

    before do
      allow(request).to receive(:headers).and_return(headers)
    end

    describe ".impersonation_token_present_in_request?" do
      it "returns true when impersonation header is present" do
        headers["x-flexile-impersonation"] = "Bearer some_token"
        
        expect(ImpersonationService.impersonation_token_present_in_request?(request)).to be true
      end

      it "returns false when header is missing" do
        expect(ImpersonationService.impersonation_token_present_in_request?(request)).to be false
      end

      it "returns false when header doesn't start with Bearer" do
        headers["x-flexile-impersonation"] = "some_token"
        
        expect(ImpersonationService.impersonation_token_present_in_request?(request)).to be false
      end
    end

    describe ".extract_impersonation_token_from_request" do
      it "extracts token from valid header" do
        headers["x-flexile-impersonation"] = "Bearer test_token"
        
        token = ImpersonationService.extract_impersonation_token_from_request(request)
        
        expect(token).to eq("test_token")
      end

      it "returns nil for invalid header" do
        headers["x-flexile-impersonation"] = "test_token"
        
        token = ImpersonationService.extract_impersonation_token_from_request(request)
        
        expect(token).to be_nil
      end
    end
  end
end
