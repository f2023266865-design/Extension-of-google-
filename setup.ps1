$ErrorActionPreference = 'Stop'

Write-Host 'Setting up AI Learning Copilot MVP...' -ForegroundColor Cyan

if (-not (Test-Path '.\backend\.env') -and (Test-Path '.\backend\.env.example')) {
  Copy-Item '.\backend\.env.example' '.\backend\.env'
  Write-Host 'Created backend/.env from template' -ForegroundColor Yellow
}

if (-not (Test-Path '.\extension\.env') -and (Test-Path '.\extension\.env.example')) {
  Copy-Item '.\extension\.env.example' '.\extension\.env'
  Write-Host 'Created extension/.env from template' -ForegroundColor Yellow
}

Push-Location '.\backend'
npm install
npm run check
Pop-Location

Push-Location '.\extension'
npm install
npm run check
npm run build
Pop-Location

Write-Host 'Setup complete. Fill backend/.env and extension/.env before deploying.' -ForegroundColor Green