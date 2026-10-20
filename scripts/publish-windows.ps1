$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot 'services/api/Cube4Notes.Server/Cube4Notes.Server.csproj'
$outputDir = Join-Path $projectRoot 'dist/win-x64'
$buildDir = Join-Path $projectRoot 'services/api/Cube4Notes.Server/bin/publish-windows/'

dotnet publish $projectFile --configuration Release --runtime win-x64 --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    "-p:BaseOutputPath=$buildDir" `
    --output $outputDir

if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao gerar o executavel do Cube4Notes.'
}

Write-Host "Executavel: $(Join-Path $outputDir 'Cube4Notes.Server.exe')"
