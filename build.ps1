Write-Host "========================================"
Write-Host "       INTERNETLAN GO - BUILD"
Write-Host "========================================"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "Khong tim thay Go trong PATH."
    exit 1
}

go fmt ./...
go build -o InternetLAN.exe .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build thanh cong: InternetLAN.exe"
}
