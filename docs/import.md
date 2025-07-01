# Worker Import Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Setting Up Workers](#setting-up-workers)
  - [Finding Admin User](#finding-admin-user)
  - [Defining Worker Data](#defining-worker-data)
- [Inviting Workers](#inviting-workers)
  - [Processing Workers](#processing-workers)
  - [Handling Results](#handling-results)
- [Worker Types](#worker-types)
  - [Project-Based Workers](#project-based-workers)
  - [Hourly Workers](#hourly-workers)

## Getting Started

### Accessing the Console

```bash
heroku run rails console -a flexile
```

## Setting Up Workers

### Finding Admin User

First, locate the company admin user who will be inviting the workers:

```ruby
puts "👋 Starting worker invitation script"

# Find the company admin user - replace with actual admin email
admin = User.find_by(email: "admin@company.com")
puts "👤 Found admin user | email = #{admin.email}"

# Find the company and company administrator
company = admin.companies.first
company_administrator = admin.company_administrators.first
puts "🏢 Found company | name = #{company.name}"
puts "👔 Found company administrator | id = #{company_administrator.id}"
```

### Defining Worker Data

Define the workers data structure with all necessary information:

```ruby
# Define workers data
workers = [
  {
    name: "Example Project Worker",
    email: "project.worker@example.com",
    role: "Sr. SWE",
    start_date: Date.parse("2024-07-01"),
    pay_rate: 3208.33,
    pay_type: "project_based"
  },
  {
    name: "Example Hourly Worker",
    email: "hourly.worker@example.com",
    role: "Accounting",
    start_date: Date.parse("2024-05-15"),
    pay_rate: 25.00,
    pay_type: "hourly"
  }
]

puts "📋 Processing #{workers.length} workers"
```

## Inviting Workers

### Processing Workers

Iterate through each worker and create invitation parameters:

```ruby
workers.each do |worker|
  puts "👤 Processing worker | name = #{worker[:name]} | email = #{worker[:email]}"

  worker_params = {
    email: worker[:email],
    started_at: worker[:start_date],
    pay_rate_in_subunits: (worker[:pay_rate] * 100).to_i,
    pay_rate_type: worker[:pay_type].downcase,
    role: worker[:role],
  }

  puts "📝 Inviting worker with params | #{worker_params}"

  result = InviteWorker.new(
    current_user: admin,
    company: company,
    company_administrator: company_administrator,
    worker_params: worker_params
  ).perform

  if result[:success]
    puts "✅ Successfully invited worker | name = #{worker[:name]}"
  else
    puts "❌ Failed to invite worker | name = #{worker[:name]} | error = #{result[:error_message]}"
  end
end

puts "🎉 Finished processing all workers"
```

### Handling Results

The script will output success or failure messages for each worker invitation. Monitor the console output to ensure all workers are successfully invited.

## Worker Types

### Project-Based Workers

For project-based workers:

- Set `pay_type: "project_based"`
- Pay rate represents the total project amount

### Hourly Workers

For hourly workers:

- Set `pay_type: "hourly"`
- Pay rate represents the hourly rate

## Complete Script Example

```ruby
puts "👋 Starting worker invitation script"

# Find the company admin user - replace with actual admin email
admin = User.find_by(email: "admin@company.com")
puts "👤 Found admin user | email = #{admin.email}"

# Find the company and company administrator
company = admin.companies.first
company_administrator = admin.company_administrators.first
puts "🏢 Found company | name = #{company.name}"
puts "👔 Found company administrator | id = #{company_administrator.id}"

# Define workers data
workers = [
  {
    name: "Example Project Worker",
    email: "project.worker@example.com",
    role: "Sr. SWE",
    start_date: Date.parse("2024-07-01"),
    pay_rate: 3208.33,
    pay_type: "project_based"
  },
  {
    name: "Example Hourly Worker",
    email: "hourly.worker@example.com",
    role: "Accounting",
    start_date: Date.parse("2024-05-15"),
    pay_rate: 25.00,
    pay_type: "hourly"
  }
]

puts "📋 Processing #{workers.length} workers"

workers.each do |worker|
  puts "👤 Processing worker | name = #{worker[:name]} | email = #{worker[:email]}"

  worker_params = {
    email: worker[:email],
    started_at: worker[:start_date],
    pay_rate_in_subunits: (worker[:pay_rate] * 100).to_i,
    pay_rate_type: worker[:pay_type].downcase,
    role: worker[:role],
  }

  puts "📝 Inviting worker with params | #{worker_params}"

  result = InviteWorker.new(
    current_user: admin,
    company: company,
    company_administrator: company_administrator,
    worker_params: worker_params
  ).perform

  if result[:success]
    puts "✅ Successfully invited worker | name = #{worker[:name]}"
  else
    puts "❌ Failed to invite worker | name = #{worker[:name]} | error = #{result[:error_message]}"
  end
end

puts "🎉 Finished processing all workers"
```
