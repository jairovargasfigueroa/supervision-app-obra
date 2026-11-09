# 602 · Compila el APK de la app que apunta a la nube (Keycloak en Azure y Sincronización en AWS) y, con -Instalar, lo
# instala por cable. Es un APK de release firmado con la clave de depuración de la plantilla de Expo (la misma de la
# development build: se instala encima). El JavaScript va dentro del APK: no necesita Metro ni la computadora.
# Uso (desde mobile/app-obra):
#   ./scripts/apk-nube.ps1 [-Instalar] [-Limpiar] [-GoogleServices <ruta>] [-Keycloak <url>] [-Sincronizacion <url>]
#   -Limpiar         regenera android/ (npx expo prebuild --clean); hace falta la primera vez y si cambia
#                    -GoogleServices o una dependencia nativa
#   -GoogleServices  google-services.json de Firebase (010), para los avisos push; sin él, la app va sin avisos
# Queda en dist/app-obra-nube.apk (fuera del repo). Requisitos de compilación: README, «Development build de Android».
param(
    [switch]$Instalar,
    [switch]$Limpiar,
    [string]$GoogleServices,
    [string]$Keycloak = 'https://keycloak.supervision.workflow-tramites.site',
    [string]$Sincronizacion = 'https://sincronizacion.supervision.workflow-tramites.site',
    [string]$Arquitecturas = 'arm64-v8a'
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Paso([string]$Texto) { Write-Host ''; Write-Host "== $Texto" -ForegroundColor Cyan }
function Detener([string]$Texto) { Write-Host ''; Write-Host "ERROR: $Texto" -ForegroundColor Red; exit 1 }
# Los programas externos (npx, gradlew, adb) escriben avisos en stderr: con la salida redirigida (por ejemplo a un
# archivo), PowerShell 5.1 los convierte en errores y 'Stop' cortaría el script. Se juzgan por $LASTEXITCODE.
function Externo([scriptblock]$Comando) {
    $ErrorActionPreference = 'Continue'
    & $Comando 2>&1 | ForEach-Object { "$_" }
}

# Las direcciones las lee app.config.js al compilar (601) y quedan dentro del APK
$env:EXPO_PUBLIC_KEYCLOAK_URL = $Keycloak.TrimEnd('/')
$env:EXPO_PUBLIC_SINCRONIZACION_URL = $Sincronizacion.TrimEnd('/')
if ($GoogleServices) {
    if (-not (Test-Path $GoogleServices)) { Detener "No existe $GoogleServices." }
    $env:GOOGLE_SERVICES_JSON = (Resolve-Path $GoogleServices).Path
} else {
    Remove-Item Env:GOOGLE_SERVICES_JSON -ErrorAction SilentlyContinue
}
Paso 'Direcciones de la nube'
Write-Host "Keycloak:        $env:EXPO_PUBLIC_KEYCLOAK_URL"
Write-Host "Sincronización:  $env:EXPO_PUBLIC_SINCRONIZACION_URL"
Write-Host "Firebase:        $(if ($GoogleServices) { $env:GOOGLE_SERVICES_JSON } else { '(sin avisos push)' })"

if ($Limpiar -or -not (Test-Path 'android')) {
    Paso 'Carpeta android/ (npx expo prebuild)'
    $argumentos = @('expo', 'prebuild', '--platform', 'android')
    if ($Limpiar) { $argumentos += '--clean' }
    Externo { npx.cmd @argumentos }
    if ($LASTEXITCODE -ne 0) { Detener 'npx expo prebuild falló (salida de arriba).' }
}
# CMake 3.31.6 para las rutas largas de C++ en Windows (README, paso 2); prebuild --clean borra este archivo
$propiedades = 'android/local.properties'
if (-not (Test-Path $propiedades)) {
    $sdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
    if (-not (Test-Path (Join-Path $sdk 'cmake/3.31.6'))) { Detener "Falta CMake 3.31.6 en $sdk (Android Studio → SDK Manager → SDK Tools)." }
    $sdkBarras = $sdk -replace '\\', '/'
    Set-Content -Encoding ascii $propiedades "sdk.dir=$sdkBarras`ncmake.dir=$sdkBarras/cmake/3.31.6"
    Write-Host "ok       $propiedades con CMake 3.31.6"
}

Paso "APK de release ($Arquitecturas)"
Push-Location 'android'
try {
    Externo { .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Arquitecturas" }
    if ($LASTEXITCODE -ne 0) { Detener 'gradlew assembleRelease falló (salida de arriba).' }
} finally { Pop-Location }
$apk = 'android/app/build/outputs/apk/release/app-release.apk'
if (-not (Test-Path $apk)) { Detener "No quedó el APK en $apk." }
New-Item -ItemType Directory -Force 'dist' | Out-Null
Copy-Item -Force $apk 'dist/app-obra-nube.apk'
$megas = [math]::Round((Get-Item 'dist/app-obra-nube.apk').Length / 1MB, 1)
Write-Host "ok       dist/app-obra-nube.apk ($megas MB)"

if ($Instalar) {
    Paso 'Instalar en el celular conectado por USB'
    $adb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
    if (-not (Test-Path $adb)) { $adb = 'adb' }
    Externo { & $adb install -r 'dist/app-obra-nube.apk' }
    if ($LASTEXITCODE -ne 0) {
        Detener 'adb install falló. Si dice INSTALL_FAILED_UPDATE_INCOMPATIBLE, desinstala antes la app del celular (otra firma).'
    }
    Write-Host 'ok       instalada: abre app-obra en el celular (ya no necesita Metro ni adb reverse)'
}
exit 0
