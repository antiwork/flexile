# frozen_string_literal: true

module WiseHelpers
  def stub_wise_webhooks_requests(profile_id, existing_webhooks: nil)
    WebMock.stub_request(:get, "#{WISE_API_URL}/v3/profiles/#{profile_id}/subscriptions")
      .to_return(
        status: 200,
        body: (existing_webhooks || []).to_json,
        headers: { content_type: "application/json" }
      )

    WebMock.stub_request(:post, "#{WISE_API_URL}/v3/profiles/#{profile_id}/subscriptions")
      .with(body: /transfers#state-change/)
      .to_return(
        status: 201,
        headers: { content_type: "application/json" },
        body: {
          id: "92d98922-940a-48ee-b6d5-7050ec769d73",
          name: "Flexile - transfers#state-change",
          delivery: { version: "2.0.0", url: Wise::PayoutApi::WEBHOOKS_URLS["transfers#state-change"] },
          trigger_on: "transfers#state-change",
          created_by: { type: "user", id: "6209470" },
          created_at: "2023-03-18T16:01:09Z",
          scope: { domain: "profile", id: profile_id },
          request_headers: nil,
          enabled: true,
        }.to_json
      )

    WebMock.stub_request(:post, "#{WISE_API_URL}/v3/profiles/#{profile_id}/subscriptions")
      .with(body: /balances#credit/)
      .to_return(
        status: 201,
        headers: { content_type: "application/json" },
        body: {
          id: "3e9f6768-f059-412a-bbf3-6a9d5a4c0afb",
          name: "Flexile - balances#credit",
          delivery: { version: "2.0.0", url: Wise::PayoutApi::WEBHOOKS_URLS["balances#credit"] },
          trigger_on: "balances#credit",
          created_by: { type: "user", id: "6209470" },
          created_at: "2023-03-18T16:01:09Z",
          scope: { domain: "profile", id: profile_id },
          request_headers: nil,
          enabled: true,
        }.to_json
      )

    if existing_webhooks.present?
      WebMock.stub_request(:delete, "#{WISE_API_URL}/v3/profiles/#{profile_id}/subscriptions/#{existing_webhooks.first["id"]}").to_return(status: 204)
    end
  end

  def select_wise_field(value, from:)
    wait_for_ajax
    select value, from:
    wait_for_ajax
  end
end
