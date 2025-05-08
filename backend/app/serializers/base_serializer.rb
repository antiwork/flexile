# frozen_string_literal: true

class BaseSerializer
  attr_reader :object

  def initialize(object)
    @object = object
  end

  def attributes
    raise "Not implemented"
  end
end
