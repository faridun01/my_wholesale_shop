# PowerShell database backup script for My Wholesale Shop
param (
    [string]$BackupDir = ".\backups",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbUser = "",
    [string]$DbName = ""
)

if (-not $DbUser) {
    if ($env:POSTGRES_USER) { $DbUser = $env:POSTGRES_USER } else { $DbUser = "postgres" }
}
if (-not $DbName) {
    if ($env:POSTGRES_DB) { $DbName = $env:POSTGRES_DB } else { $DbName = "wholesale_shop" }
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "backup_${DbName}_${timestamp}.sql"

Write-Host "Creating PostgreSQL backup to $backupFile..."

$env:PGPASSWORD = $env:POSTGRES_PASSWORD
pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $backupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully: $backupFile"
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
}
