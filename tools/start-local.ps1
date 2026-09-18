$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$watcher = Start-Process -FilePath python -ArgumentList 'tools/build.py','--watch' -WorkingDirectory $root -PassThru
$server = Start-Process -FilePath python -ArgumentList '-m','http.server','8080' -WorkingDirectory $root -PassThru

Write-Host "Watcher iniciado (PID $($watcher.Id))."
Write-Host "Host iniciado (PID $($server.Id))."
Write-Host "Site: http://localhost:8080"
Write-Host "Para encerrar os dois processos: Stop-Process -Id $($watcher.Id),$($server.Id)"
