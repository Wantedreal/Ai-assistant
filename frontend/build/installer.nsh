; Battery Pack Designer — NSIS custom install hook
; Included automatically by electron-builder into the generated installer.
;
; What this does:
;   Silently downloads and installs the Microsoft Visual C++ 2022 x64
;   Redistributable if it is not already present on the target machine.
;   The OCP/OpenCascade bindings (used for STEP export) require
;   MSVCP140.dll and VCRUNTIME140.dll which ship with this runtime.

!macro customInstall
  ; Fast check: if the DLL already exists, skip entirely (most machines)
  IfFileExists "$SYSDIR\MSVCP140.dll" vc_done vc_install

  vc_install:
    DetailPrint "Installing Visual C++ 2022 Runtime (required component)..."
    ; curl is built into Windows 10 1803+ and Windows 11
    ; /install /quiet /norestart = silent, no reboot prompt
    nsExec::ExecToLog 'cmd.exe /C "curl -L --silent --retry 3 -o "%TEMP%\vc_redist.exe" "https://aka.ms/vs/17/release/vc_redist.x64.exe" && "%TEMP%\vc_redist.exe" /install /quiet /norestart & del "%TEMP%\vc_redist.exe""'

  vc_done:
!macroend
