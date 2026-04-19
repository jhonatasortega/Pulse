param (
    [Parameter(Mandatory=$false)]
    [string]$Target,

    [Parameter(Mandatory=$false)]
    [string]$RemoteDir = "C:\pulse_deploy"
)

if (-not $Target) {
    Write-Host "==> Deploying Pulse LOCALMENTE (Windows Mode)" -ForegroundColor Magenta

    # 1. Criar pasta se não existir
    if (-not (Test-Path $RemoteDir)) {
        New-Item -ItemType Directory -Path $RemoteDir -Force | Out-Null
    }

    # 2. Copiar arquivos limpos
    Write-Host "==> Sincronizando arquivos para $RemoteDir..." -ForegroundColor Cyan
    robocopy . $RemoteDir /MIR /XD node_modules .vite __pycache__ data .git /XF *.pyc /R:2 /W:5 /NFL /NDL /NJH /NJS

    Set-Location $RemoteDir

    # 3. LIMPEZA DO COMPOSE PARA WINDOWS (O segredo está aqui)
    Write-Host "==> Removendo mounts incompatíveis com Windows..." -ForegroundColor Yellow
    $ComposeFile = Join-Path $RemoteDir "docker-compose.yml"
    $Content = Get-Content $ComposeFile
    
    # Filtra e remove qualquer linha que tenha rshared ou mounts de sistema Linux
    $NewContent = $Content | Where-Object { 
        $_ -notmatch ':rshared' -and 
        $_ -notmatch ' - /:/host' -and
        $_ -notmatch ' - /mnt:/mnt' -and
        $_ -notmatch ' - /media:/media' -and
        $_ -notmatch ' - /home:/home' -and
        $_ -notmatch ' - /var/lib/docker/volumes'
    }
    $NewContent | Set-Content $ComposeFile

    # 4. RESET DO CONTAINER
    Write-Host "==> Resetando container pulse_backend..." -ForegroundColor Yellow
    docker rm -f pulse_backend 2>$null

    # 5. START
    Write-Host "==> Iniciando Docker Compose..." -ForegroundColor Cyan
    docker compose up -d --build

    $AccessUrl = "localhost"

} else {
    # --- MODO REMOTO (Raspberry Pi) ---
    Write-Host "==> Deploying Pulse to $Target" -ForegroundColor Cyan
    ssh "$Target" "mkdir -p $RemoteDir"
    rsync -avz --progress --exclude 'node_modules' --exclude '.vite' --exclude '__pycache__' --exclude '*.pyc' --exclude 'data/' --exclude '.git' . "$($Target):$RemoteDir/"
    ssh "$Target" "cd $RemoteDir && docker compose down --remove-orphans; docker compose up -d --build"
    $AccessUrl = $Target.Split('@')[-1]
}

Write-Host "`nPulse Deployed! Access: http://$($AccessUrl):3000" -ForegroundColor Green