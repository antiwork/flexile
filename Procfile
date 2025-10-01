web: cd backend && bundle exec rails server -p $PORT -e $RAILS_ENV -b 0.0.0.0
worker: cd backend && bundle exec sidekiq -q default -q mailers
release: cd backend && bundle exec rails db:migrate
