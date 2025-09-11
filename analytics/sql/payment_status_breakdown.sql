-- Payment Status Breakdown
-- Provides insights into payment success rates and failure patterns

SELECT 
  status,
  COUNT(*) as payment_count,
  ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric, 2) as percentage,
  SUM(total_amount_cents)::decimal / 100 as total_amount_usd,
  AVG(total_amount_cents)::decimal / 100 as avg_amount_usd,
  MIN(created_at) as first_payment,
  MAX(created_at) as latest_payment
FROM payments
GROUP BY status
ORDER BY payment_count DESC;