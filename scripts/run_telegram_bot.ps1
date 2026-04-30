<#
.SYNOPSIS
  Start Telegram userbot (Telethon + Redis consumer) from CRM repo root.

.DESCRIPTION
  Sets API_URL and REDIS_URL before Python starts so Docker hostnames from .env
  (backend, redis) are not used when you run the bot on your PC.
  TELEGRAM_* vars still load from .env via python-dotenv in bot.config.

  Local bot + server CRM: use -Remote or -Hybrid. API must be FastAPI on port 8000
  (e.g. http://SERVER:8000), not Nginx :80 alone, because /api/bot/* is on backend.

  First-time session:
    python -m bot.gen_session
  Put TELEGRAM_SESSION into .env

.PARAMETER Remote
  Same as -Hybrid: API http://SERVER:8000, Redis redis://SERVER:6379/0

.PARAMETER Hybrid
  Alias for -Remote (local process, server API + Redis).

.PARAMETER Server
  Hostname or IP for -Remote / -Hybrid.

.PARAMETER ApiUrl
  Override API base URL.

.PARAMETER RedisUrl
  Override Redis URL.

.EXAMPLE
  .\scripts\run_telegram_bot.ps1

.EXAMPLE
  .\scripts\run_telegram_bot.ps1 -Remote

.EXAMPLE
  .\scripts\run_telegram_bot.ps1 -Hybrid -Server 62.181.53.36

.EXAMPLE
  .\scripts\run_telegram_bot.ps1 -ApiUrl "http://127.0.0.1:8000" -RedisUrl "redis://127.0.0.1:6379/0"
#>
param(
  [switch]$Remote,
  [switch]$Hybrid,
  [string]$Server = "62.181.53.36",
  [string]$ApiUrl = "",
  [string]$RedisUrl = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$UseServer = $Remote -or $Hybrid

if ($ApiUrl -ne "") {
  $env:API_URL = $ApiUrl
} elseif ($UseServer) {
  $env:API_URL = "http://${Server}:8000"
} else {
  $env:API_URL = "http://127.0.0.1:8000"
}

if ($RedisUrl -ne "") {
  $env:REDIS_URL = $RedisUrl
} elseif ($UseServer) {
  $env:REDIS_URL = "redis://${Server}:6379/0"
} else {
  $env:REDIS_URL = "redis://127.0.0.1:6379/0"
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "Python not found in PATH. Install Python 3.12+ and: pip install -r bot/requirements.txt"
}

if (-not (Test-Path ".env")) {
  Write-Warning ".env missing in repo root. You need TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION."
}

Write-Host "API_URL   = $($env:API_URL)"
Write-Host "REDIS_URL = $($env:REDIS_URL)"
Write-Host "Starting: python -m bot.main`n"

if ($UseServer) {
  # Single quotes: inside double quotes, "-RedisUrl" is parsed as unary minus.
  Write-Warning 'Server Redis (port 6379) must be reachable from this PC. If blocked, use SSH tunnel: ssh -L 6379:127.0.0.1:6379 root@YOUR_SERVER then run with -RedisUrl redis://127.0.0.1:6379/0'
}

python -m bot.main
