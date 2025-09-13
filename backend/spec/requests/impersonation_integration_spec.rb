# frozen_string_literal: true

RSpec.describe "Impersonation Integration", type: :request do
  let(:admin_user) { create(:user, team_member: true) }
  let(:regular_user) { create(:user, team_member: false) }
  let(:target_user) { create(:user, email: "target@example.com") }
  let(:admin_jwt) { JwtService.generate_token(admin_user) }

  def auth_headers(jwt)
    { "x-flexile-auth" => "Bearer #{jwt}" }
  end

  describe "Full impersonation flow" do
    it "completes full impersonation cycle successfully" do
      # Step 1: Admin requests impersonation
      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(admin_jwt)

      expect(response).to have_http_status(:ok)
      json_response = JSON.parse(response.body)
      impersonation_jwt = json_response["impersonation_jwt"]

      # Step 2: Verify impersonation JWT is valid and contains correct user info
      expect(impersonation_jwt).to be_present
      decoded_user = JwtService.user_from_token(impersonation_jwt)
      expect(decoded_user).to eq(target_user)

      # Step 3: Verify admin JWT still works
      admin_decoded_user = JwtService.user_from_token(admin_jwt)
      expect(admin_decoded_user).to eq(admin_user)
    end

    it "maintains proper authentication context during impersonation" do
      # Get impersonation JWT
      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(admin_jwt)

      impersonation_jwt = JSON.parse(response.body)["impersonation_jwt"]

      # Test that impersonated JWT decodes to target user
      decoded_user = JwtService.user_from_token(impersonation_jwt)
      expect(decoded_user.email).to eq(target_user.email)
      expect(decoded_user.team_member).to eq(target_user.team_member)
    end

    it "prevents impersonated user from performing admin actions" do
      # Create regular user and get impersonation JWT
      regular_target = create(:user, team_member: false)

      post "/internal/admin/impersonation",
           params: { email: regular_target.email },
           headers: auth_headers(admin_jwt)

      impersonation_jwt = JSON.parse(response.body)["impersonation_jwt"]

      # Try to use impersonated JWT for admin action - should fail
      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(impersonation_jwt)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "Security validations" do
    it "prevents token reuse after user deletion" do
      # Get impersonation JWT
      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(admin_jwt)

      impersonation_jwt = JSON.parse(response.body)["impersonation_jwt"]

      # Delete the target user
      target_user.destroy!

      # Try to decode the JWT - should return nil since user no longer exists
      decoded_user = JwtService.user_from_token(impersonation_jwt)
      expect(decoded_user).to be_nil
    end

    it "prevents impersonation with expired admin JWT" do
      # Create expired admin JWT
      expired_payload = {
        user_id: admin_user.id,
        email: admin_user.email,
        exp: 1.hour.ago.to_i,
      }
      expired_jwt = JWT.encode(expired_payload, JwtService.send(:jwt_secret), "HS256")

      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(expired_jwt)

      expect(response).to have_http_status(:unauthorized)
    end

    it "validates JWT signature for impersonation requests" do
      # Create JWT with wrong signature
      payload = {
        user_id: admin_user.id,
        email: admin_user.email,
        exp: 24.hours.from_now.to_i,
      }
      wrong_jwt = JWT.encode(payload, "wrong_secret", "HS256")

      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(wrong_jwt)

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "Error handling" do
    it "handles malformed JSON in request body gracefully" do
      post "/internal/admin/impersonation",
           params: "invalid json",
           headers: auth_headers(admin_jwt).merge({ "Content-Type" => "application/json" })

      expect(response).to have_http_status(:bad_request)
    end

    it "handles missing Content-Type header" do
      # Rails should still parse params correctly
      post "/internal/admin/impersonation",
           params: { email: target_user.email },
           headers: auth_headers(admin_jwt)

      expect(response).to have_http_status(:ok)
    end

    it "handles concurrent impersonation requests" do
      # Simulate concurrent requests for same user
      threads = []
      results = []

      5.times do
        threads << Thread.new do
          post "/internal/admin/impersonation",
               params: { email: target_user.email },
               headers: auth_headers(admin_jwt)
          results << response.status
        end
      end

      threads.each(&:join)

      # All requests should succeed
      expect(results).to all(eq(200))
    end
  end

  describe "Performance considerations" do
    it "handles multiple impersonation requests efficiently" do
      users = create_list(:user, 10, team_member: false)

      start_time = Time.current

      users.each do |user|
        post "/internal/admin/impersonation",
             params: { email: user.email },
             headers: auth_headers(admin_jwt)
        expect(response).to have_http_status(:ok)
      end

      end_time = Time.current

      # Should complete within reasonable time (adjust threshold as needed)
      expect(end_time - start_time).to be < 5.seconds
    end

    it "generates unique JWTs for each impersonation request" do
      jwts = []

      3.times do |i|
        # Use time travel to ensure different timestamps
        travel_to(i.seconds.from_now) do
          post "/internal/admin/impersonation",
               params: { email: target_user.email },
               headers: auth_headers(admin_jwt)

          jwt = JSON.parse(response.body)["impersonation_jwt"]
          jwts << jwt
        end
      end

      # All JWTs should be unique (due to timestamp differences)
      expect(jwts.uniq.length).to eq(3)
    end
  end
end
