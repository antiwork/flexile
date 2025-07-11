# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Invoices Performance', type: :request do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let!(:admin) { create(:company_administrator, company: company, user: admin_user) }
  let(:contractor_user) { create(:user) }
  let!(:contractor) { create(:company_contractor, company: company, user: contractor_user) }

  before do
    # Authenticate as admin for the requests
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(admin_user)
    allow_any_instance_of(ApplicationController).to receive(:current_company).and_return(company)
  end

  describe 'GET /invoices (invoice list endpoint)' do
    context 'with large number of invoices' do
      before do
        # Create a realistic number of invoices with various states
        create_invoice_dataset(200)
      end

      it 'responds quickly even with many invoices' do
        start_time = Time.current
        
        get '/invoices'
        
        end_time = Time.current
        response_time = ((end_time - start_time) * 1000).round(2)
        
        expect(response).to have_http_status(:success)
        expect(response_time).to be < 500.0 # Should respond in under 500ms
      end

      it 'maintains performance with filtering and sorting' do
        # Test the most common query patterns
        start_time = Time.current
        
        # This simulates the frontend query pattern
        invoices = company.invoices
                         .where(deleted_at: nil)
                         .order(invoice_date: :desc, created_at: :desc)
                         .limit(50)
                         .to_a
        
        end_time = Time.current
        query_time = ((end_time - start_time) * 1000).round(2)
        
        expect(invoices.length).to be > 0
        expect(query_time).to be < 100.0 # Should complete in under 100ms
        
        # Verify results are properly ordered
        dates = invoices.map(&:invoice_date)
        expect(dates).to eq(dates.sort.reverse)
      end

      it 'efficiently handles pagination-like queries' do
        # Test performance of offset queries (simulating pagination)
        times = []
        
        [0, 50, 100].each do |offset|
          start_time = Time.current
          
          company.invoices
                 .where(deleted_at: nil)
                 .order(invoice_date: :desc, created_at: :desc)
                 .limit(25)
                 .offset(offset)
                 .to_a
          
          end_time = Time.current
          times << ((end_time - start_time) * 1000).round(2)
        end
        
        # Performance should remain consistent across pages
        expect(times.max).to be < 100.0
        expect(times.max - times.min).to be < 50.0 # Variance should be low
      end
    end

    context 'performance regression protection' do
      it 'uses database indexes efficiently' do
        # Create enough data to make index usage crucial
        create_invoice_dataset(100)
        
        # Execute query and capture the execution plan
        query = company.invoices
                      .where(deleted_at: nil)
                      .order(invoice_date: :desc, created_at: :desc)
                      .limit(50)
        
        explained_query = ActiveRecord::Base.connection.execute(
          "EXPLAIN (ANALYZE) #{query.to_sql}"
        ).to_a
        
        execution_plan = explained_query.map { |row| row['QUERY PLAN'] }.join("\n")
        
        # Should use index scan, not sequential scan
        expect(execution_plan).to include('Index Scan')
        expect(execution_plan).not_to include('Seq Scan on invoices')
        
        # Should not need additional sorting step
        expect(execution_plan).not_to include('Sort')
      end
    end
  end

  private

  def create_invoice_dataset(count)
    # Create a realistic mix of invoices with different dates and statuses
    statuses = %w[received approved paid failed rejected]
    
    count.times do |i|
      status = statuses.sample
      
      invoice = create(:invoice,
        company: company,
        company_contractor: contractor,
        status: status,
        invoice_date: rand(365).days.ago.to_date,
        created_at: rand(365).days.ago,
        deleted_at: nil
      )
      
      # Randomly soft-delete some invoices to test the deleted_at filter
      if rand < 0.05 # 5% chance
        invoice.update!(deleted_at: rand(30).days.ago)
      end
    end
    
    # Ensure we have some recent invoices for realistic testing
    5.times do |i|
      create(:invoice,
        company: company,
        company_contractor: contractor,
        invoice_date: i.days.ago.to_date,
        created_at: i.days.ago,
        deleted_at: nil
      )
    end
  end
end