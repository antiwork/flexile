# frozen_string_literal: true

require "hexapdf"

class CustomPDFTextExtractor < HexaPDF::Content::Processor
  attr_reader :texts

  def initialize
    super
    @texts = []
  end

  def show_text(str)
    @texts << decode_text(str)
  end

  alias :show_text_with_positioning :show_text

  private
    def decode_text(str)
      str
    end
end
