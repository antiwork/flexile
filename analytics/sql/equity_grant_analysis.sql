-- Equity Grant Analysis
-- Analyzes equity grants distribution and vesting patterns

-- Grant summary by type and status
SELECT 
  grant_type,
  status,
  COUNT(*) as grant_count,
  SUM(total_shares) as total_shares_granted,
  AVG(total_shares) as avg_shares_per_grant,
  SUM(vested_shares) as total_vested_shares,
  CASE 
    WHEN SUM(total_shares) > 0 THEN 
      ROUND((SUM(vested_shares)::decimal / SUM(total_shares) * 100)::numeric, 2)
    ELSE 0
  END as vesting_percentage,
  MIN(grant_date) as earliest_grant,
  MAX(grant_date) as latest_grant
FROM equity_grants
GROUP BY grant_type, status
ORDER BY grant_type, status;