# frozen_string_literal: true

Aws.config.update(
  region: ENV["AWS_REGION"],
  credentials: Aws::Credentials.new(ENV["AWS_ACCESS_KEY_ID"], ENV["AWS_SECRET_ACCESS_KEY"])
)

# When using MinIO locally, provide endpoint and path-style addressing.
# With real AWS S3, do not set these options.
if ENV["AWS_ENDPOINT_URL"].present?
  Aws.config.update(
    s3: {
      endpoint: ENV["AWS_ENDPOINT_URL"],
      force_path_style: true,
    }
  )
end
