# frozen_string_literal: true

RSpec::Matchers.define_negated_matcher :not_change, :change

RSpec::Matchers.matcher :match_path_and_query_params do |expected_path_with_query_params|
  match do |actual|
    expectedUri = Addressable::URI.parse(expected_path_with_query_params)
    actualUri = Addressable::URI.parse(actual)
    actualUri.path == expectedUri.path && actualUri.query_values == expectedUri.query_values
  end
end

RSpec::Matchers.matcher :json_redirect_to do |expected_redirect_to_path|
  match do |actual_response|
    actual_response.status == 403 &&
      actual_response.parsed_body[:redirect_path] == expected_redirect_to_path
  end

  failure_message do |actual_response|
    "expected response to redirect to #{expected_redirect_to_path} with status 403, " \
    "but got #{actual_response.parsed_body[:redirect_path]} with status #{actual_response.status}"
  end
end

RSpec::Matchers.define :be_performed_with do |expected_args|
  match do |klass|
    expect(klass).to receive(:new)
      .with(**expected_args)
      .and_wrap_original do |method, **args|
        service = method.call(**args)
        expect(service).to receive(:perform).and_call_original
        service
      end
  end
end
