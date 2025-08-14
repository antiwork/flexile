# frozen_string_literal: true

class StripeService end
Rails.application.config.to_prepare do
  module ServiceAdapters
    def self.with_instance(service_class, real:, mock:)
      service_class.define_singleton_method(:instance) do
        @instance ||= if Rails.env.test? || ENV["USE_MOCK_SERVICES"] == "true"
          mock.new
        else
          real.new
        end
      end

      service_class.define_singleton_method(:method_missing) do |name, *args, &block|
        instance.public_send(name, *args, &block)
      end

      service_class.define_singleton_method(:respond_to_missing?) do |name, include_private = false|
        instance.respond_to?(name) || super(name, include_private)
      end
    end
  end

  ServiceAdapters.with_instance(StripeService, real: RealStripeService, mock: MockStripeService)
end
