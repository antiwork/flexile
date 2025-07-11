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
    3.times { run_full_activerecord_query }
  end

  def benchmark_invoice_list_query
    puts "⏱️  Timing full ActiveRecord query with joins/includes (10 iterations):"
    puts "   (This tests the complete application query performance)"
    
    times = []
    10.times do |i|
      start_time = Time.current
      run_full_activerecord_query
      end_time = Time.current
      
      duration = ((end_time - start_time) * 1000).round(2)
      times << duration
      print "."
    end
    
    puts "\n"
    puts "   Average: #{(times.sum / times.length).round(2)}ms"
    puts "   Min:     #{times.min}ms"
    puts "   Max:     #{times.max}ms"
    
    # Calculate median correctly for even/odd length arrays
    sorted_times = times.sort
    median = if times.length.odd?
      sorted_times[times.length / 2]
    else
      (sorted_times[times.length / 2 - 1] + sorted_times[times.length / 2]) / 2.0
    end
    puts "   Median:  #{median.round(2)}ms"
  end

  def explain_analyze_query
    puts "\n🔍 Query execution plan for index-focused SQL:"
    puts "   (This shows how the composite index optimizes WHERE/ORDER BY)"
    
    sql = build_index_focused_sql
    result = ActiveRecord::Base.connection.execute("EXPLAIN (ANALYZE, BUFFERS) #{sql}")
    
    result.each do |row|
      puts "   #{row['QUERY PLAN']}"
    end
  end

  def benchmark_scalability
    puts "\n📈 Scalability test using index-focused SQL (queries with different result sizes):"
    puts "   (This isolates the index performance without join overhead)"
    
    # Test with different limits to simulate pagination
    [10, 50, 100, 500].each do |limit|
      sql = build_index_focused_sql(limit)
      
      start_time = Time.current
      ActiveRecord::Base.connection.execute(sql)
      end_time = Time.current
      
      duration = ((end_time - start_time) * 1000).round(2)
      puts "   LIMIT #{limit.to_s.rjust(3)}: #{duration}ms"
    end
  end

  def run_full_activerecord_query
    # Full ActiveRecord query as used in the application
    # This includes joins and eager loading which add overhead beyond the index optimization
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

  def build_index_focused_sql(limit = 100)
    # Simplified SQL that focuses on testing the composite index performance
    # This isolates the WHERE/ORDER BY optimization without join overhead
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
  
  This script benchmarks two aspects of invoice list performance:
  
  1. Full ActiveRecord Query Performance
     - Tests the complete application query with joins and includes
     - Shows real-world performance including all overhead
  
  2. Index-Focused SQL Performance  
     - Isolates the composite index optimization
     - Tests only the WHERE/ORDER BY clauses without join overhead
     - Better demonstrates the specific index improvement
  
  The composite index optimizes:
  - WHERE company_id = ? AND deleted_at IS NULL
  - ORDER BY invoice_date DESC, created_at DESC
  
  🚀 To see the improvement:
  
  1. Run this script BEFORE applying the migration:
     ruby scripts/benchmark_invoice_list_performance.rb --run
  
  2. Apply the migration:
     rails db:migrate
  
  3. Run this script AFTER applying the migration:
     ruby scripts/benchmark_invoice_list_performance.rb --run
  
  Expected improvement: 5-50x faster for the index-focused queries
  
USAGE

if ARGV.include?("--run")
  benchmark = InvoiceListPerformanceBenchmark.new
  benchmark.run_benchmark
else
  puts "Add --run flag to execute the benchmark"
end