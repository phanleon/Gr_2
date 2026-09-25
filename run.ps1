Write-Host "========================================"
Write-Host "        INTERNETLAN GO - RUN"
Write-Host "========================================"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "Khong tim thay Go trong PATH."
    Write-Host "Hay cai Go 1.22+ va mo lai PowerShell."
    exit 1
}

go run .
