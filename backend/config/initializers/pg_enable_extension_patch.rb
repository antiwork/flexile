# frozen_string_literal: true

require "active_record/connection_adapters/postgresql_adapter"

# Patch for https://devcenter.heroku.com/changelog-items/2446 from https://stackoverflow.com/a/73289426/3315873
module EnableExtensionHerokuPatch
  def enable_extension(name, **)
    return super unless schema_exists?("heroku_ext")

    exec_query("CREATE EXTENSION IF NOT EXISTS \"#{name}\" SCHEMA heroku_ext").tap { reload_type_map }
  end
end

module ActiveRecord
  module ConnectionAdapters
    class PostgreSQLAdapter
      prepend EnableExtensionHerokuPatch
    end
  end
end
