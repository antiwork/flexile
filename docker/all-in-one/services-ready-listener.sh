#!/bin/bash
# Event listener for supervisor to start application after services are ready

# Read events from stdin
while read line; do
    # Parse the event
    echo "$line" >&2
    
    # Check if all core services are running
    if supervisorctl status postgresql | grep -q RUNNING && \
       supervisorctl status redis | grep -q RUNNING && \
       supervisorctl status minio | grep -q RUNNING; then
        
        # Check if application services are not yet started
        if supervisorctl status rails | grep -q STOPPED; then
            echo "Core services are ready, starting application..." >&2
            
            # Run database setup
            cd /app/backend
            bundle exec rails db:prepare 2>&1
            
            # Setup MinIO buckets
            /usr/local/bin/mc alias set local http://localhost:9000 minioadmin minioadmin123 2>&1
            /usr/local/bin/mc mb local/flexile-development-private --ignore-existing 2>&1
            /usr/local/bin/mc mb local/flexile-development-public --ignore-existing 2>&1
            
            # Start application services
            supervisorctl start rails
            sleep 5
            supervisorctl start sidekiq
            supervisorctl start nextjs
            sleep 5
            supervisorctl start nginx
        fi
    fi
    
    # Acknowledge the event
    echo "RESULT 2"
    echo "OK"
done