# frozen_string_literal: true

PgSearch.multisearch_options = {
  using: {
    tsearch: {
      prefix: true,
    },
  },
}
