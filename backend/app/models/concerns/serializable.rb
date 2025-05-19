# frozen_string_literal: true

module Serializable
  extend ActiveSupport::Concern

  def fetch_serializer(namespace: nil)
    serializer = "#{self.class.name}Serializer"
    serializer = "#{namespace}::#{serializer}" if namespace.present?
    serializer.constantize.new(self)
  end

  def serialize(namespace: nil)
    serializer = fetch_serializer(namespace:)
    JSON.generate(serializer.attributes)
  end
end
