-- Payment Volume Analysis
-- Analyzes payment trends, volumes, and patterns over time

-- Daily payment volume summary
WITH daily_payments AS (
  SELECT 
    DATE(created_at) as payment_date,
    COUNT(*) as payment_count,
    SUM(total_amount_cents)::decimal / 100 as total_volume_usd,
    AVG(total_amount_cents)::decimal / 100 as avg_payment_usd,
    MIN(total_amount_cents)::decimal / 100 as min_payment_usd,
    MAX(total_amount_cents)::decimal / 100 as max_payment_usd
  FROM payments 
  WHERE status = 'completed'
  GROUP BY DATE(created_at)
  ORDER BY payment_date DESC
)
SELECT 
  payment_date,
  payment_count,
  total_volume_usd,
  avg_payment_usd,
  min_payment_usd,
  max_payment_usd,
  LAG(total_volume_usd) OVER (ORDER BY payment_date) as prev_day_volume,
  CASE 
    WHEN LAG(total_volume_usd) OVER (ORDER BY payment_date) > 0 THEN
      ROUND(((total_volume_usd - LAG(total_volume_usd) OVER (ORDER BY payment_date)) / 
             LAG(total_volume_usd) OVER (ORDER BY payment_date) * 100)::numeric, 2)
    ELSE NULL
  END as volume_change_pct
FROM daily_payments
ORDER BY payment_date DESC
LIMIT 30;