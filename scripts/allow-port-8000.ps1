# Run this script AS ADMINISTRATOR to allow your phone to reach both servers.
# Right-click PowerShell → "Run as Administrator", then:
#   cd "C:\Main\Work\Assesment Work\constructai"
#   .\scripts\allow-port-8000.ps1

$rules = @(
    @{ Name = "ConstructAI API (port 8000)";   Port = 8000; Desc = "FastAPI backend" },
    @{ Name = "ConstructAI Metro (port 8081)";  Port = 8081; Desc = "Expo Metro bundler" }
)

foreach ($r in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "✓ Already exists: $($r.Name)" -ForegroundColor Green
    } else {
        New-NetFirewallRule `
            -DisplayName $r.Name `
            -Direction Inbound `
            -Protocol TCP `
            -LocalPort $r.Port `
            -Action Allow `
            -Profile Private,Domain `
            -Description "Allow phone (LAN) to reach $($r.Desc) on port $($r.Port)"
        Write-Host "✓ Added rule: $($r.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Done. Restart 'expo start' and scan the QR code again." -ForegroundColor Cyan
