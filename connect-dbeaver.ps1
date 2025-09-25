# PowerShell script para conectar DBeaver ao PostgreSQL no WSL
# Execute este script no PowerShell como Administrador

Write-Host "Configurando redirecionamento de porta para PostgreSQL..." -ForegroundColor Green

# Remove regra existente se houver
netsh interface portproxy delete v4tov4 listenport=5432 listenaddress=127.0.0.1 2>$null

# Obtém o IP do WSL2
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim().Split()[0] }
Write-Host "IP do WSL2: $wslIP" -ForegroundColor Yellow

# Cria nova regra de redirecionamento
netsh interface portproxy add v4tov4 listenport=5432 listenaddress=127.0.0.1 connectport=5432 connectaddress=$wslIP

Write-Host "✅ Configuração completa!" -ForegroundColor Green
Write-Host ""
Write-Host "Agora no DBeaver use:" -ForegroundColor Cyan
Write-Host "  Host: 127.0.0.1" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Database: mainframe_ai" -ForegroundColor White
Write-Host "  Username: mainframe_user" -ForegroundColor White
Write-Host "  Password: mainframe_pass" -ForegroundColor White

# Testa a conexão
Write-Host ""
Write-Host "Testando conexão..." -ForegroundColor Yellow
Test-NetConnection -ComputerName 127.0.0.1 -Port 5432