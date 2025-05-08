# frozen_string_literal: true

module ExternalId
  extend ActiveSupport::Concern

  included do
    before_create -> { ExternalIdGenerator.process(self) }
  end

  module ExternalIdGenerator
    extend self

    ID_ALPHABET = [*(0..9).to_a, *("a".."z").to_a].join
    ID_LENGTH = 13
    ID_MAX_RETRY = 1000

    def process(record)
      ID_MAX_RETRY.times do
        record.external_id = Nanoid.generate(size: ID_LENGTH, alphabet: ID_ALPHABET)
        return unless record.class.where(external_id: record.external_id).exists?
      end
      raise "Failed to generate a unique external id after #{ID_MAX_RETRY} attempts"
    end
  end
end
