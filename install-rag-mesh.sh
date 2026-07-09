#!/bin/bash
set -e

echo "🌐 RAG Mesh-Netzwerk installieren..."

sudo cp /home/benjamin/projects/rag-custom-knowledge/rag-mesh-custom.service /etc/systemd/system/
sudo cp /home/benjamin/projects/rag-it-knowledge/rag-mesh-it.service /etc/systemd/system/

# Firewall: Mesh-Ports öffnen (UDP Discovery + HTTP Worker)
if command -v ufw &>/dev/null; then
    sudo ufw allow 9710/udp comment "RAG Mesh Discovery"
    sudo ufw allow 9711/tcp comment "RAG Mesh Worker (custom)"
    sudo ufw allow 9712/tcp comment "RAG Mesh Worker (IT)"
    echo "✅ UFW-Regeln gesetzt"
elif command -v firewall-cmd &>/dev/null; then
    sudo firewall-cmd --permanent --add-port=9710/udp
    sudo firewall-cmd --permanent --add-port=9711/tcp
    sudo firewall-cmd --permanent --add-port=9712/tcp
    sudo firewall-cmd --reload
    echo "✅ Firewalld-Regeln gesetzt"
fi

sudo systemctl daemon-reload
sudo systemctl enable rag-mesh-custom.service rag-mesh-it.service
sudo systemctl restart rag-mesh-custom.service rag-mesh-it.service

echo ""
echo "✅ Mesh-Services aktiv:"
sudo systemctl status rag-mesh-custom.service --no-pager -l || true
echo "---"
sudo systemctl status rag-mesh-it.service --no-pager -l || true
echo ""
echo "📡 Ports:"
echo "  UDP 9710  — Peer-Discovery (Broadcast)"
echo "  TCP 9711  — Mesh-Worker custom-knowledge"
echo "  TCP 9712  — Mesh-Worker it-knowledge"
echo "  TCP 8090  — HTTP API custom-knowledge"
echo "  TCP 8089  — HTTP API it-knowledge"
echo ""
echo "🔍 Test: curl http://localhost:8090/health"
echo "🔍 Test: curl http://localhost:8089/health"
echo "🔍 Test: curl http://localhost:8090/peers"
