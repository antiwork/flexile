# frozen_string_literal: true

Date::DATE_FORMATS[:short] = "%-d %b" # Date with no zero-padding + Short Month name
Date::DATE_FORMATS[:medium] = "%b %-d, %Y" # Date with no zero-padding + Short Month name + Year
Date::DATE_FORMATS[:long] = "%B %-d, %Y" # Date with no zero-padding + Long Month name + Year
Date::DATE_FORMATS[:us_date] = "%-m/%-d/%Y" # Month/Date/Year with no zero-padding
