#!/usr/bin/env ruby
# frozen_string_literal: true

# Benchmark script to demonstrate invoice list query performance improvement
# Run this before and after applying the composite index migration

require_relative "../backend/config/environment"

class InvoiceListPerformanceBenchmark
  def initialize
    @company = Company.first
    raise "No company found. Please run seeds first." unless @company
    
    puts "Benchmarking invoice list performance for company: #{@company.name}"
    puts "Current invoice count: #{@company.invoices.alive.count}"
    puts "=" * 60
  end

  def run_benchmark
    # Warm up the query
    warm_up_queries

    puts "\n📊 Performance Benchmark Results:"
    puts "-" * 40

    # Benchmark the exact query from the TRPC endpoint
    benchmark_invoice_list_query
    
    # Benchmark with EXPLAIN ANALYZE
    explain_analyze_query
    
    # Test performance with different company sizes
    benchmark_scalability
  end

  private

  def warm_up_queries
    puts "🔥 Warming up database connection..."
    3.times { run_invoice_list_query }
  end

  def benchmark_invoice_list_query
    puts "⏱️  Timing invoice list query (10 iterations):"
    
    times = []
    10.times do |i|
      start_time = Time.current
      run_invoice_list_query
      end_time = Time.current
      
      duration = ((end_time - start_time) * 1000).round(2)
      times << duration
      print "."
    end
    
    puts "\n"
    puts "   Average: #{(times.sum / times.length).round(2)}ms"
    puts "   Min:     #{times.min}ms"
    puts "   Max:     #{times.max}ms"
    puts "   Median:  #{times.sort[times.length / 2]}ms"
  end

  def explain_analyze_query
    puts "\n🔍 Query execution plan:"
    
    sql = build_invoice_list_sql
    sanitized_sql = ActiveRecord::Base.sanitize_sql_array([sql])
    result = ActiveRecord::Base.connection.execute("EXPLAIN (ANALYZE, BUFFERS) #{sanitized_sql}")
    
    result.each do |row|
      puts "   #{row['QUERY PLAN']}"
    end
  end

  def benchmark_scalability
    puts "\n📈 Scalability test (queries with different result sizes):"
    
    # Test with different limits to simulate pagination
    [10, 50, 100, 500].each do |limit|
      sql = build_invoice_list_sql(limit)
      
      start_time = Time.current
      ActiveRecord::Base.connection.execute(sql)
      end_time = Time.current
      
      duration = ((end_time - start_time) * 1000).round(2)
      puts "   LIMIT #{limit.to_s.rjust(3)}: #{duration}ms"
    end
  end

  def run_invoice_list_query
    # This mirrors the exact query from frontend/trpc/routes/invoices.ts line 315-339
    @company.invoices
             .joins(company_contractor: :user)
             .includes(
               :rejector,
               approvals: :approver,
               contractor: {
                 user: :user_compliance_infos
               }
             )
             .where(deleted_at: nil)
             .order(invoice_date: :desc, created_at: :desc)
             .limit(100)
             .to_a
  end

  def build_invoice_list_sql(limit = 100)
    # Build the raw SQL to match the Drizzle query from the frontend
    # Use parameterized queries to prevent SQL injection
    ActiveRecord::Base.sanitize_sql_array([<<~SQL, @company.id, limit])
      SELECT invoices.*
      FROM invoices
      WHERE invoices.company_id = ?
        AND invoices.deleted_at IS NULL
      ORDER BY invoices.invoice_date DESC, invoices.created_at DESC
      LIMIT ?
    SQL
  end
end

# Usage instructions
puts <<~USAGE
  🎯 Invoice List Performance Benchmark
  
  This script benchmarks the performance of the invoice list query that's used
  in the TRPC endpoint (frontend/trpc/routes/invoices.ts).
  
  The query filters by:
  - company_id = [current company]
  - deleted_at IS NULL
  
  And orders by:
  - invoice_date DESC, created_at DESC
  
  🚀 To see the improvement:
  
  1. Run this script BEFORE applying the migration:
     ruby scripts/benchmark_invoice_list_performance.rb
  
  2. Apply the migration:
     rails db:migrate
  
  3. Run this script AFTER applying the migration:
     ruby scripts/benchmark_invoice_list_performance.rb
  
  Expected improvement: 5-50x faster for companies with 1000+ invoices
  
USAGE

if ARGV.include?("--run")
  benchmark = InvoiceListPerformanceBenchmark.new
  benchmark.run_benchmark
else
  puts "Add --run flag to execute the benchmark"
end