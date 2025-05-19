# frozen_string_literal: true

# Prevents Aws::S3::Errors::RequestTimeTooSkewed error by resetting the clock, when Timecop is used
#
module AwsS3ClientTimecop
  def put_object(*args, **kwargs)
    if defined?(Timecop)
      Timecop.return do
        super(*args, **kwargs)
      end
    else
      super(*args, **kwargs)
    end
  end
end
