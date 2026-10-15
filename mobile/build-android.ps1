$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$taskRoot = Split-Path -Parent $PSScriptRoot
$artifactsRoot = Join-Path $taskRoot 'artifacts'
$toolsRoot = Join-Path $artifactsRoot 'toolchain'
New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
function Get-CheckedArchive($Url, $Name, $Algorithm, $Expected) {
    $target = Join-Path $toolsRoot $Name
    if (-not (Test-Path -LiteralPath $target)) {
        Write-Host "Baixando $Name de fonte oficial"
        Invoke-WebRequest -Uri $Url -OutFile $target
    }
    if ((Get-FileHash -LiteralPath $target -Algorithm $Algorithm).Hash.ToLowerInvariant() -ne $Expected.Trim().ToLowerInvariant()) { throw "Checksum invalido: $Name" }
    return $target
}
function Move-CheckedFolder($Source, $Destination) {
    $sourceAbsolute = [IO.Path]::GetFullPath($Source)
    $destinationAbsolute = [IO.Path]::GetFullPath($Destination)
    if (-not $sourceAbsolute.StartsWith($toolsRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or -not $destinationAbsolute.StartsWith($toolsRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Diretorio fora da area de ferramentas' }
    Move-Item -LiteralPath $sourceAbsolute -Destination $destinationAbsolute
}
$jdkDirectory = Join-Path $toolsRoot 'jdk'
if (-not (Test-Path -LiteralPath (Join-Path $jdkDirectory 'bin/javac.exe'))) {
    $asset = (Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')[0]
    $archive = Get-CheckedArchive $asset.binary.package.link 'jdk17.zip' 'SHA256' $asset.binary.package.checksum
    $extract = Join-Path $toolsRoot 'jdk-extract'
    Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
    $source = Get-ChildItem -LiteralPath $extract -Directory | Where-Object Name -Like 'jdk-*' | Select-Object -First 1
    Move-CheckedFolder $source.FullName $jdkDirectory
}
$gradleDirectory = Join-Path $toolsRoot 'gradle-8.13'
if (-not (Test-Path -LiteralPath (Join-Path $gradleDirectory 'bin/gradle.bat'))) {
    $checksum = (Invoke-WebRequest 'https://services.gradle.org/distributions/gradle-8.13-bin.zip.sha256').Content
    if ($checksum -is [byte[]]) { $checksum = [Text.Encoding]::UTF8.GetString($checksum) }
    $archive = Get-CheckedArchive 'https://services.gradle.org/distributions/gradle-8.13-bin.zip' 'gradle-8.13.zip' 'SHA256' $checksum
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
}
$sdkDirectory = Join-Path $toolsRoot 'android-sdk'
$packages = @(
    @{ Name='platform-36_r02.zip'; Hash='2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576'; Destination='platforms/android-36'; Check='android.jar'; Extract='platform-extract' },
    @{ Name='build-tools_r36_windows.zip'; Hash='f16ccffd34de8790dede813a6c7d8e2c11a27b50'; Destination='build-tools/36.0.0'; Check='aapt2.exe'; Extract='build-tools-extract' }
)
foreach ($package in $packages) {
    $destination = Join-Path $sdkDirectory $package.Destination
    if (-not (Test-Path -LiteralPath (Join-Path $destination $package.Check))) {
        $archive = Get-CheckedArchive ('https://dl.google.com/android/repository/' + $package.Name) $package.Name 'SHA1' $package.Hash
        $extract = Join-Path $toolsRoot $package.Extract
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $source = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Move-CheckedFolder $source.FullName $destination
    }
}
# All environment changes are limited to this build process.
$env:JAVA_HOME = $jdkDirectory
$env:ANDROID_HOME = $sdkDirectory
$env:ANDROID_SDK_ROOT = $sdkDirectory
$env:GRADLE_USER_HOME = Join-Path $toolsRoot 'gradle-cache'
Write-Output 'Compilando APK e executando Android Lint localmente'
& (Join-Path $gradleDirectory 'bin/gradle.bat') '-p' (Join-Path $taskRoot 'mobile/android') '--no-daemon' '--max-workers=2' '-Pandroid.overridePathCheck=true' 'assembleDebug' 'lintDebug'
if ($LASTEXITCODE -ne 0) { throw "Falha na compilacao Android: $LASTEXITCODE" }
$apk = Join-Path $artifactsRoot 'em-pauta-homologacao.apk'
Copy-Item -LiteralPath (Join-Path $taskRoot 'mobile/android/app/build/outputs/apk/debug/app-debug.apk') -Destination $apk -Force
Get-FileHash -LiteralPath $apk -Algorithm SHA256 | Format-List
