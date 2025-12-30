#!/bin/sh
# SCHNITTWERK Docker Entrypoint
# Creates admin user on first startup, then runs Next.js

set -e

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@schnittwerk.ch}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
SUPABASE_URL="${SUPABASE_URL_INTERNAL:-http://kong:8000}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Function to create admin user
create_admin_user() {
    echo "[init] Checking if admin user needs to be created..."

    # Wait for Supabase API to be ready (max 60 seconds)
    for i in $(seq 1 30); do
        # Try to list users - if it works, API is ready
        response=$(wget -q -O - --header="Authorization: Bearer ${SERVICE_KEY}" \
            --header="apikey: ${SERVICE_KEY}" \
            "${SUPABASE_URL}/auth/v1/admin/users" 2>/dev/null || echo "")

        if echo "$response" | grep -q '\['; then
            echo "[init] Supabase API is ready"

            # Check if admin user already exists
            if echo "$response" | grep -q "\"email\":\"${ADMIN_EMAIL}\""; then
                echo "[init] Admin user already exists, skipping creation"
                return 0
            fi

            # Create admin user
            echo "[init] Creating admin user: ${ADMIN_EMAIL}"
            result=$(wget -q -O - --header="Authorization: Bearer ${SERVICE_KEY}" \
                --header="apikey: ${SERVICE_KEY}" \
                --header="Content-Type: application/json" \
                --post-data="{
                    \"email\": \"${ADMIN_EMAIL}\",
                    \"password\": \"${ADMIN_PASSWORD}\",
                    \"email_confirm\": true,
                    \"user_metadata\": {\"first_name\": \"Admin\", \"last_name\": \"Schnittwerk\", \"role\": \"admin\"}
                }" \
                "${SUPABASE_URL}/auth/v1/admin/users" 2>&1 || echo "failed")

            if echo "$result" | grep -q '"id"'; then
                echo "[init] Admin user created successfully!"
            else
                echo "[init] Warning: Could not create admin user"
                echo "[init] Response: $result"
            fi
            return 0
        fi

        echo "[init] Waiting for Supabase API... ($i/30)"
        sleep 2
    done

    echo "[init] Warning: Supabase API not ready after 60 seconds, skipping admin creation"
}

# Run admin creation in background (non-blocking)
create_admin_user &

# Start the Next.js application
echo "[init] Starting Next.js application..."
exec node server.js
