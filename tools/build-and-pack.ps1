param(
    [string]$Creator = 'D:\Cocos\editors\Creator\3.8.8\CocosCreator.exe',
    [string]$Node = 'node',
    [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$config = Join-Path $PSScriptRoot 'build-options.json'
$logRoot = Join-Path $projectRoot 'build'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$job = Start-Process -FilePath $Creator -ArgumentList @('--disable-gpu', '--no-sandbox', ('--user-data-dir=' + (Join-Path $projectRoot 'temp\editor-profile-build')), '--project', ('"' + $projectRoot + '"'), '--build', ('"configPath=' + $config + '"')) -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logRoot 'builder-stdout.log') -RedirectStandardError (Join-Path $logRoot 'builder-stderr.log')
if ($job.ExitCode -ne 36) { throw "Cocos build failed with exit code $($job.ExitCode). See build/builder-stderr.log." }
& $Node (Join-Path $PSScriptRoot 'pack-single-html.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Single HTML packing failed.' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'build\undersea-adventure-single.html') -Destination (Join-Path $projectRoot 'build\undersea-adventure-full.html') -Force
& $Python (Join-Path $PSScriptRoot 'prepare-vercel.py') $Node
if ($LASTEXITCODE -ne 0) { throw 'Mobile distribution preparation failed.' }
& $Python (Join-Path $PSScriptRoot 'pack-gzip-html.py')
if ($LASTEXITCODE -ne 0) { throw 'Embedded gzip HTML packing failed.' }
Write-Output ('HTML: ' + (Join-Path $projectRoot 'build\undersea-adventure-single.html'))
