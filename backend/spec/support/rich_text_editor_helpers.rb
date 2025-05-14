# frozen_string_literal: true

module RichTextEditorHelpers
  def find_rich_text_editor(name)
    find(:xpath, XPath.descendant[XPath.attr(:id) == XPath.anywhere(:label)[XPath.string.n.is(name)].attr(:for)])
  end

  def fill_in_rich_text_editor(name, with:)
    node = find_rich_text_editor(name)
    node.set(with)
  end
end
