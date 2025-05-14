# frozen_string_literal: true

class ImmutableValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if !record.public_send("#{attribute}_changed?") ||
              !record.persisted? ||
              !record.public_send("#{attribute}_was").present?

    record.errors.add(attribute, "cannot be changed once set")
  end
end
