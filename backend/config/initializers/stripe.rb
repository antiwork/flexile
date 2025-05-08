# frozen_string_literal: true

Stripe.api_key = GlobalConfig.get("STRIPE_SECRET_KEY")
Stripe.api_version = "2024-04-10"
