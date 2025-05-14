# frozen_string_literal: true

# Allows `rails db:setup` to work as expected (can error with `ActiveModel::UnknownAttributeError: unknown attribute 'team_member' for User`),
# until this is addressed: https://github.com/pboling/flag_shih_tzu/issues/52
Rails.application.reloader.reload! if Rails.env.development?

def format_duration(seconds)
  hours = seconds / 3600
  minutes = (seconds % 3600) / 60
  seconds = seconds % 60

  parts = []
  parts << "#{hours.to_i}h" if hours >= 1
  parts << "#{minutes.to_i}m" if minutes >= 1 || hours >= 1
  parts << "#{seconds.round(2)}s"

  parts.join(" ")
end

template_name = "gumroad"
file_path = Rails.root.join("config", "data", "seed_templates", "#{template_name}.json")
template = JSON.parse(File.read(file_path))
config = template.fetch("config")
$stdout.puts "\nGenerating seed data using #{template_name} template."
$stdout.puts "Default values:"
config.each do |key, value|
  $stdout.puts "#{key}: #{value}"
end
if ENV["SEED_EMAIL"].blank?
  $stdout.puts "ℹ️ To replace the default email, set the SEED_EMAIL environment variable. " \
    "It will be used to generate aliases for seed data accounts (like username+gumroad@gmail.com)."
end
$stdout.puts "\n"

fast_mode = ENV["SEED_DISABLE_FAST_MODE"].to_s.downcase.in?(%w[true 1]) ? false : true
if fast_mode
  $stdout.puts "🚀 Fast mode enabled. To generate the complete seed data, set SEED_DISABLE_FAST_MODE=true."
  $stdout.puts "\n"
end

time = Benchmark.measure do
  SeedDataGeneratorFromTemplate.new(
    template: template_name,
    email: ENV["SEED_EMAIL"],
    fast_mode:,
  ).perform!
end

$stdout.puts "\nSeed data generation completed!"
$stdout.puts "  User CPU time: #{format_duration(time.utime)}"
$stdout.puts "  System CPU time: #{format_duration(time.stime)}"
$stdout.puts "  Total time: #{format_duration(time.real)}"
