# PowerShell script to fix DBeaver connection to PostgreSQL in WSL2
# Execute this script in PowerShell as Administrator

Write-Host "=== DBeaver PostgreSQL Connection Fix ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get WSL2 IP
Write-Host "1. Getting WSL2 IP address..." -ForegroundColor Yellow
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim().Split()[0] }
Write-Host "   WSL2 IP: $wslIP" -ForegroundColor Green

# Step 2: Remove old port proxy rules
Write-Host ""
Write-Host "2. Removing old port proxy rules..." -ForegroundColor Yellow
netsh interface portproxy delete v4tov4 listenport=5432 listenaddress=127.0.0.1 2>$null
netsh interface portproxy delete v4tov4 listenport=5432 listenaddress=0.0.0.0 2>$null
Write-Host "   OK - Old rules removed" -ForegroundColor Green

# Step 3: Add new port forwarding rule
Write-Host ""
Write-Host "3. Creating new port forwarding rule..." -ForegroundColor Yellow
netsh interface portproxy add v4tov4 listenport=5432 listenaddress=0.0.0.0 connectport=5432 connectaddress=$wslIP
Write-Host "   OK - Port forwarding configured" -ForegroundColor Green

# Step 4: Show current rules
Write-Host ""
Write-Host "4. Current port proxy rules:" -ForegroundColor Yellow
netsh interface portproxy show v4tov4

# Step 5: Configure Windows Firewall
Write-Host ""
Write-Host "5. Configuring Windows Firewall..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "PostgreSQL WSL2" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow -ErrorAction SilentlyContinue
Write-Host "   OK - Firewall rule configured" -ForegroundColor Green

# Step 6: Test connection
Write-Host ""
Write-Host "6. Testing connection to PostgreSQL..." -ForegroundColor Yellow
Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue

Write-Host ""
Write-Host "=== Configuration Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "DBeaver Connection Settings:" -ForegroundColor Cyan
Write-Host "  Server Host: localhost (or 127.0.0.1)" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Database: mainframe_ai" -ForegroundColor White
Write-Host "  Username: mainframe_user" -ForegroundColor White
Write-Host "  Password: mainframe_pass" -ForegroundColor White
Write-Host ""
Write-Host "Alternative - Direct WSL2 IP:" -ForegroundColor Cyan
Write-Host "  Server Host: $wslIP" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host ""
Write-Host "If connection still fails, try:" -ForegroundColor Yellow
Write-Host "  1. Restart DBeaver" -ForegroundColor White
Write-Host "  2. Use the WSL2 IP directly ($wslIP)" -ForegroundColor White
Write-Host '  3. Disable Windows Defender Firewall temporarily to test' -ForegroundColor White