# frozen_string_literal: true

Time::DATE_FORMATS[:long_date] = "%B %-d, %Y" # Date with no zero-padding + Long Month name + Year
Time::DATE_FORMATS[:us_date] = "%-m/%-d/%Y" # Month/Date/Year with no zero-padding
