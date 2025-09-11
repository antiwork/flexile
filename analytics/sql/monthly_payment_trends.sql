-- Monthly Payment Trends
-- Analyzes payment patterns and growth trends by month

WITH monthly_stats AS (
  SELECT 
    DATE_TRUNC('month', created_at) as month_year,
    COUNT(*) as payment_count,
    SUM(total_amount_cents)::decimal / 100 as total_volume_usd,
    COUNT(DISTINCT contractor_id) as unique_contractors,
    AVG(total_amount_cents)::decimal / 100 as avg_payment_usd
  FROM payments 
  WHERE status = 'completed'
  GROUP BY DATE_TRUNC('month', created_at)
  ORDER BY month_year DESC
)
SELECT 
  month_year,
  payment_count,
  total_volume_usd,
  unique_contractors,
  avg_payment_usd,
  LAG(total_volume_usd) OVER (ORDER BY month_year) as prev_month_volume,
  LAG(payment_count) OVER (ORDER BY month_year) as prev_month_count,
  CASE 
    WHEN LAG(total_volume_usd) OVER (ORDER BY month_year) > 0 THEN
      ROUND(((total_volume_usd - LAG(total_volume_usd) OVER (ORDER BY month_year)) / 
             LAG(total_volume_usd) OVER (ORDER BY month_year) * 100)::numeric, 2)
    ELSE NULL
  END as volume_growth_pct,
  CASE 
    WHEN LAG(payment_count) OVER (ORDER BY month_year) > 0 THEN
      ROUND(((payment_count - LAG(payment_count) OVER (ORDER BY month_year)) / 
             LAG(payment_count)::decimal OVER (ORDER BY month_year) * 100)::numeric, 2)
    ELSE NULL
  END as count_growth_pct
FROM monthly_stats
ORDER BY month_year DESC
LIMIT 12;