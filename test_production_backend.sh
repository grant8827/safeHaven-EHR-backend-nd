#!/bin/bash

echo "🔍 Testing Production Backend..."
echo ""
echo "Testing health endpoint:"
curl -s https://safehaven-ehr-backend-nd-production.up.railway.app/api/health | jq .

echo ""
echo ""
echo "If you see {\"status\":\"ok\",\"message\":\"Safe Haven EHR Backend is running\"}"
echo "then your backend is working! ✅"
echo ""
echo "If you see 502 error, Railway environment variables are still not configured."
