# frozen_string_literal: true

class BasePresenter
  def initialize(model)
    @model = model
  end

  private
    attr_reader :model

    # Common field serialization methods
    def serialize_id
      model.id
    end

    def serialize_external_id
      model.external_id
    end

    def serialize_created_at
      model.created_at.iso8601
    end

    def serialize_updated_at
      model.updated_at.iso8601
    end

    def serialize_date(date_field)
      date_field&.iso8601
    end

    # Currency conversion methods
    def cents_to_usd(cents_amount)
      return nil if cents_amount.nil?
      cents_amount / 100.0
    end

    def decimal_to_float(decimal_amount)
      decimal_amount&.to_f
    end

    # Common base fields that most models have
    def base_fields
      {
        id: serialize_id,
        created_at: serialize_created_at,
        updated_at: serialize_updated_at,
      }
    end

    # Base fields with external_id (for models that use external_id as primary identifier)
    def base_fields_with_external_id
      base_fields.merge(id: serialize_external_id)
    end
end
