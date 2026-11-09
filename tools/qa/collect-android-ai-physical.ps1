#requires -Version 5.1
param([string]$OutputDirectory = "android-ai-physical-qa")
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { throw "adb가 PATH에 없습니다." }
$devices = @(adb devices | Select-String '^[^\s]+\s+device$')
if ($LASTEXITCODE -ne 0 -or $devices.Count -ne 1) { throw "USB 디버깅이 허용된 기기 1대가 필요합니다." }
function Get-Prop([string]$Name) { return (adb shell getprop $Name | Out-String).Trim() }
$abi = Get-Prop "ro.product.cpu.abi"
if ($abi -ne "arm64-v8a") { throw "ARM64 검증 대상이 아닙니다: $abi" }
$hardware = Get-Prop "ro.hardware"
if ($hardware -match '(?i)ranchu|goldfish|qemu') { throw "에뮬레이터는 물리 기기 결과로 사용할 수 없습니다." }
$report = [ordered]@{
  qaStep = "AI-01-B"
  deviceModel = Get-Prop "ro.product.model"
  androidApi = Get-Prop "ro.build.version.sdk"
  abi = $abi
  ramMeminfo = ((adb shell cat /proc/meminfo | Select-String '^(MemTotal|MemAvailable):') -join '; ').Trim()
  dataStorage = ((adb shell df -k /data | Out-String).Trim())
  geminiNanoStatus = "NOT_EXECUTED"
  qwen3_06 = "NOT_EXECUTED"
  qwen35_08 = "NOT_EXECUTED"
  qwen35_2 = "NOT_EXECUTED"
  gemma4_e2b = "NOT_EXECUTED"
  note = "Environment metadata only. Models have not been tested by this script."
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$path = Join-Path $OutputDirectory "device-environment.json"
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $path -Encoding UTF8
adb shell am start -a android.intent.action.VIEW -d 'pushofficeapp://ai-models' | Out-Null
Write-Host "ARM64 기기 환경 보고서: $path"
Write-Host "실제 AI 다운로드/추론은 Push Office 기기 AI 모델 관리 화면에서 별도 검증해야 합니다."
