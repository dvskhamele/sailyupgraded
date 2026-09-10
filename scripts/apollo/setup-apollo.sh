#!/usr/bin/env bash
set -e

echo "=================================================="
echo "APOLLO SERVER SETUP & RECOVERY SCRIPT"
echo "Server: 129.146.64.133 | Port: 8000"
echo "=================================================="

PROJECT_DIR="/home/ubuntu/apollo_project"
mkdir -p "$PROJECT_DIR/api"
cd "$PROJECT_DIR"

# 1. Setup Python Virtualenv
if [ ! -d "venv" ]; then
    echo "[1/6] Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "[2/6] Installing Python dependencies..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install fastapi "uvicorn[standard]" pymysql dbutils pydantic cryptography

# 2. Verify API file exists
if [ ! -f "$PROJECT_DIR/api/main.py" ]; then
    echo "Error: $PROJECT_DIR/api/main.py not found! Please ensure main.py is placed in $PROJECT_DIR/api/"
    exit 1
fi

# 3. Configure systemd service
echo "[3/6] Setting up systemd service..."
sudo cp "$PROJECT_DIR/apollo.service" /etc/systemd/system/apollo.service 2>/dev/null || true

# If not copied from file, create it directly
if [ ! -f /etc/systemd/system/apollo.service ]; then
    sudo bash -c "cat > /etc/systemd/system/apollo.service" << 'EOF'
[Unit]
Description=Apollo People & Contacts FastAPI Microservice
After=network.target mysql.service mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/apollo_project
ExecStart=/home/ubuntu/apollo_project/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 7149 --workers 4 --access-log
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
fi

# 4. Open Firewall & Security Rules for port 7149
echo "[4/6] Configuring firewall rules for port 7149..."
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 7149/tcp || true
fi

# Add iptables rule for Oracle Linux / Ubuntu on OCI
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 7149 -j ACCEPT 2>/dev/null || true
if command -v netfilter-persistent >/dev/null 2>&1; then
    sudo netfilter-persistent save || true
fi

# 5. Reload & Start Service
echo "[5/6] Starting Apollo systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable apollo.service
sudo systemctl restart apollo.service

sleep 2

# 6. Verify Service Health & Pagination
echo "[6/6] Verifying API endpoints..."
echo "Checking service status:"
sudo systemctl status apollo.service --no-pager -l

echo ""
echo "Testing local health endpoint:"
curl -s "http://127.0.0.1:7149/health" || echo "Health check failed"

echo ""
echo "Testing local stats endpoint:"
curl -s "http://127.0.0.1:7149/stats" || echo "Stats check failed"

echo ""
echo "Testing contacts first page (limit=2):"
curl -s "http://127.0.0.1:7149/contacts?limit=2" | cut -c 1-200 || echo "Contacts limit=2 failed"

echo ""
echo "Testing offset beyond 7,182 (limit=2&offset=7182):"
curl -s "http://127.0.0.1:7149/contacts?limit=2&offset=7182" | cut -c 1-200 || echo "Offset 7182 check failed"

echo ""
echo "=================================================="
echo "APOLLO SERVER SETUP COMPLETE!"
echo "=================================================="
