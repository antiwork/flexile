# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Invoice List Query Performance', type: :request do
  describe 'composite index optimization' do
    let(:company) { create(:company) }
    let(:user) { create(:user) }
    let!(:company_contractor) { create(:company_contractor, company: company, user: user) }

    before do
      # Create test data to simulate a company with many invoices
      create_test_invoices(500) # Enough to show performance difference
    end

    it 'uses the composite index for invoice list queries' do
      query_sql = build_invoice_list_sql(company.id)
      
      # Capture the query execution plan
      execution_plan = capture_execution_plan(query_sql)
      
      # Verify the composite index is being used
      expect(execution_plan).to include_index_scan('idx_invoices_company_deleted_date_created')
      
      # Verify no table scan is happening
      expect(execution_plan).not_to include('Seq Scan on invoices')
      
      # Verify the sort operation is eliminated (index provides ordering)
      expect(execution_plan).not_to include('Sort')
    end

    it 'performs significantly faster with the composite index' do
      query_sql = build_invoice_list_sql(company.id)
      
      # Measure query execution time
      execution_time = measure_query_time(query_sql)
      
      # With 500 invoices and proper indexing, query should be very fast
      # This threshold should be adjusted based on your performance requirements
      expect(execution_time).to be < 50.0 # 50ms threshold
    end

    it "maintains consistent performance regardless of company size" do
      # Test with different data sizes to ensure O(log n) performance
      times = []

      [100, 200, 400].each do |invoice_count|
        # Clean up and create specific number of invoices
        company.invoices.delete_all  # More efficient than destroy_all
        create_test_invoices(invoice_count)

        query_sql = build_invoice_list_sql(company.id)
        time = measure_query_time(query_sql)
        times << time
      end

      # With proper indexing, query time should not increase linearly
      # Even with 4x more data, time should not increase significantly
      expect(times.last).to be < (times.first * 2)
    end

    it 'efficiently handles the exact TRPC query pattern' do
      # Simulate the exact query from frontend/trpc/routes/invoices.ts
      query_sql = ActiveRecord::Base.sanitize_sql_array([
        <<~SQL, company.id
          SELECT invoices.*
          FROM invoices
          WHERE invoices.company_id = ?
            AND invoices.deleted_at IS NULL
          ORDER BY invoices.invoice_date DESC, invoices.created_at DESC
          LIMIT 100
        SQL
      ])
      query_execution_plan = ActiveRecord::Base.connection.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) #{query_sql}").to_a
      
      plan_data = JSON.parse(query_execution_plan.first['QUERY PLAN'])
      execution_plan = plan_data[0]['Plan']
      
      # Verify efficient index-only execution
      expect(execution_plan['Node Type']).to eq('Index Scan')
      expect(execution_plan['Index Name']).to eq('idx_invoices_company_deleted_date_created')
      
      # Verify no additional sorting needed
      expect(plan_data[0]['Plan']).not_to have_key('Sort Key')
      
      # Performance should be excellent
      actual_time = execution_plan['Actual Total Time']
      expect(actual_time).to be < 10.0 # Should be under 10ms
    end

  end

  private

  def create_test_invoices(count)
    # Create invoices with varied dates to make the test realistic
    count.times do |i|
      create(:invoice,
        company: company,
        company_contractor: company_contractor,
        invoice_date: i.days.ago.to_date,
        created_at: i.days.ago,
        deleted_at: nil)
    end

    # Add some deleted invoices to test the deleted_at filter
    5.times do |i|
      create(:invoice,
        company: company,
        company_contractor: company_contractor,
        deleted_at: i.days.ago)
    end
  end

  def build_invoice_list_sql(company_id)
    ActiveRecord::Base.sanitize_sql_array([
      <<~SQL, company_id
        SELECT invoices.*
        FROM invoices
        WHERE invoices.company_id = ?
          AND invoices.deleted_at IS NULL
        ORDER BY invoices.invoice_date DESC, invoices.created_at DESC
        LIMIT 100
      SQL
    ])
  end

  def capture_execution_plan(sql)
    result = ActiveRecord::Base.connection.execute("EXPLAIN #{sql}")
    result.map { |row| row["QUERY PLAN"] }.join("\n")
  end

  def measure_query_time(sql)
    start_time = Time.current
    ActiveRecord::Base.connection.execute(sql)
    end_time = Time.current

    ((end_time - start_time) * 1000).round(2) # Return time in milliseconds
  end

  def include_index_scan(index_name)
    include("Index Scan using #{index_name}")
  end
end