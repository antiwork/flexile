# frozen_string_literal: true

Capybara.add_selector(:menuitem, locator_type: [String, Symbol]) do
  xpath do |locator, **options|
    xpath = XPath.descendant[XPath.attr(:role).equals("menuitem")]

    unless locator.nil?
      locator = locator.to_s
      matchers = [XPath.attr(:id) == locator,
                  XPath.string.n.is(locator),
                  XPath.attr(:title).is(locator),]
      matchers << XPath.attr(:'aria-label').is(locator) if enable_aria_label
      matchers << XPath.attr(test_id).equals(locator) if test_id
      xpath = xpath[matchers.reduce(:|)]
    end

    xpath
  end
end

Capybara.add_selector(:command) do
  xpath do |locator, **options|
    %i[link button menuitem].map do |selector|
      expression_for(selector, locator, **options)
    end.reduce(:union)
  end
  node_filter(:disabled, :boolean, default: false, skip_if: true) { |node, value| !(value ^ node.disabled?) }
  expression_filter(:disabled, :boolean) { |xpath, val| val ? xpath : xpath[[~XPath.attr(:"aria-disabled"), XPath.attr(:"aria-disabled") != "true"].reduce(:or)] }
  expression_filter(:role, default: true) do |xpath|
    xpath[XPath.attr(:role).one_of("button", "link", "menuitem").or ~XPath.attr(:role)]
  end
end

%i[field checkbox radio_button fillable_field select datalist_input].each do |selector|
  Capybara.modify_selector(selector) do
    node_filter(:valid, :boolean) { |node, value| node.valid? == value }
  end
end

# modified from the original to support th[scope=row]
Capybara.modify_selector(:table) do
  def cell_selector
    XPath.self(:td) | (XPath.self(:th)[XPath.attr(:scope) == "row"])
  end

  expression_filter(:with_cols, valid_values: [Array]) do |xpath, cols|
    col_conditions = cols.map do |col|
      if col.is_a? Hash
        col.reduce(nil) do |xp, (header, cell_str)|
          header = XPath.descendant(:th)[XPath.string.n.is(header)]
          td = XPath.descendant(:tr)[header].descendant[cell_selector]
          cell_condition = XPath.string.n.is(cell_str)
          if xp
            prev_cell = XPath.ancestor(:table)[1].join(xp)
            cell_condition &= (prev_cell & prev_col_position?(prev_cell))
          end
          td[cell_condition]
        end
      else
        cells_xp = col.reduce(nil) do |prev_cell, cell_str|
          cell_condition = XPath.string.n.is(cell_str)

          if prev_cell
            prev_cell = XPath.ancestor(:tr)[1].preceding_sibling(:tr).join(prev_cell)
            cell_condition &= (prev_cell & prev_col_position?(prev_cell))
          end

          XPath.descendant[cell_selector][cell_condition]
        end
        XPath.descendant(:tr).join(cells_xp)
      end
    end.reduce(:&)
    xpath[col_conditions]
  end

  expression_filter(:cols, valid_values: [Array]) do |xpath, cols|
    raise ArgumentError, ":cols must be an Array of Arrays" unless cols.all?(Array)

    rows = cols.transpose
    col_conditions = rows.map { |row| match_row(row, match_size: true) }.reduce(:&)
    xpath[match_row_count(rows.size)][col_conditions]
  end

  expression_filter(:with_rows, valid_values: [Array]) do |xpath, rows|
    rows_conditions = rows.map { |row| match_row(row) }.reduce(:&)
    xpath[rows_conditions]
  end

  expression_filter(:rows, valid_values: [Array]) do |xpath, rows|
    rows_conditions = rows.map { |row| match_row(row, match_size: true) }.reduce(:&)
    xpath[match_row_count(rows.size)][rows_conditions]
  end

  describe_expression_filters do |caption: nil, **|
    " with caption \"#{caption}\"" if caption
  end

  def prev_col_position?(cell)
    XPath.position.equals(cell_position(cell))
  end

  def cell_position(cell)
    cell.preceding_sibling[cell_selector].count.plus(1)
  end

  def match_row(row, match_size: false)
    xp = XPath.descendant(:tr)[
      if row.is_a? Hash
        row_match_cells_to_headers(row)
      else
        XPath.descendant[cell_selector][row_match_ordered_cells(row)]
      end
    ]
    xp = xp[XPath.descendant[cell_selector].count.equals(row.size)] if match_size
    xp
  end

  def match_row_count(size)
    XPath.descendant(:tbody).descendant(:tr).count.equals(size) |
      (XPath.descendant(:tr).count.equals(size) & ~XPath.descendant(:tbody))
  end

  def row_match_cells_to_headers(row)
    row.map do |header, cell|
      header_xp = XPath.ancestor(:table)[1].descendant(:tr)[1].descendant(:th)[XPath.string.n.is(header)]
      XPath.descendant[cell_selector][
        XPath.string.n.is(cell) & header_xp.boolean & XPath.position.equals(header_xp.preceding_sibling.count.plus(1))
      ]
    end.reduce(:&)
  end

  def row_match_ordered_cells(row)
    row_conditions = row.map do |cell|
      XPath.self(:td)[XPath.string.n.is(cell)]
    end
    row_conditions.reverse.reduce do |cond, cell|
      cell[XPath.following_sibling[cond]]
    end
  end
end

module Capybara
  module Node
    module Actions
      def click_command(locator = nil, **options)
        find(:command, locator, **options).click
      end
      alias_method :click_on, :click_command
    end

    class Element
      def valid?
        native.property("validity")["valid"]
      end
    end
  end

  module RSpecMatchers
    %i[command].each do |selector|
      define_method "have_#{selector}" do |locator = nil, **options, &optional_filter_block|
        Matchers::HaveSelector.new(selector, locator, **options, &optional_filter_block)
      end
    end
  end
end

RSpec::Matchers.define :have_tooltip do |text|
  match do |node|
    sleep 0.5 # without this the below hover sometimes doesn't work
    node.hover
    node = node.all(:xpath, XPath.ancestor[XPath.attr(:"aria-describedby")], wait: 0)[0] if !node["aria-describedby"]
    node&.matches_selector?("*", described_by: text)
  end
end
