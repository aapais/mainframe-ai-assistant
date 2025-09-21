;
; Custom NSIS installer script for Windows
; Provides additional installation features and customization
;

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Custom installer pages and functions

; Function to check if application is running
Function CheckIfRunning
  ; Check if the application is currently running
  FindWindow $0 "" "${PRODUCT_NAME}"
  StrCmp $0 0 notRunning
    MessageBox MB_OK|MB_ICONEXCLAMATION "Please close ${PRODUCT_NAME} before installing."
    Abort
  notRunning:
FunctionEnd

; Function to create desktop shortcut with custom icon
Function CreateDesktopShortcut
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0
FunctionEnd

; Function to add to Windows startup (if user chooses)
Function AddToStartup
  ; This will be called if user selects auto-start option
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$INSTDIR\${PRODUCT_FILENAME}.exe --startup"
FunctionEnd

; Function to remove from Windows startup
Function RemoveFromStartup
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
FunctionEnd

; Custom page for additional options
Var Dialog
Var CreateDesktopShortcutCheckbox
Var AddToStartupCheckbox
Var AssociateFilesCheckbox

Function CustomOptionsPage
  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "Additional Options:"

  ${NSD_CreateCheckbox} 10 20u 100% 10u "Create desktop shortcut"
  Pop $CreateDesktopShortcutCheckbox
  ${NSD_Check} $CreateDesktopShortcutCheckbox

  ${NSD_CreateCheckbox} 10 35u 100% 10u "Start with Windows"
  Pop $AddToStartupCheckbox

  ${NSD_CreateCheckbox} 10 50u 100% 10u "Associate .mainframe files"
  Pop $AssociateFilesCheckbox
  ${NSD_Check} $AssociateFilesCheckbox

  nsDialogs::Show
FunctionEnd

Function CustomOptionsPageLeave
  ${NSD_GetState} $CreateDesktopShortcutCheckbox $0
  ${If} $0 <> 0
    Call CreateDesktopShortcut
  ${EndIf}

  ${NSD_GetState} $AddToStartupCheckbox $0
  ${If} $0 <> 0
    Call AddToStartup
  ${EndIf}

  ${NSD_GetState} $AssociateFilesCheckbox $0
  ${If} $0 <> 0
    ; Associate .mainframe files
    WriteRegStr HKCR ".mainframe" "" "${PRODUCT_NAME}.Document"
    WriteRegStr HKCR "${PRODUCT_NAME}.Document" "" "${PRODUCT_NAME} Configuration File"
    WriteRegStr HKCR "${PRODUCT_NAME}.Document\DefaultIcon" "" "$INSTDIR\${PRODUCT_FILENAME}.exe,0"
    WriteRegStr HKCR "${PRODUCT_NAME}.Document\shell\open\command" "" '"$INSTDIR\${PRODUCT_FILENAME}.exe" "%1"'
  ${EndIf}
FunctionEnd

; Pre-installation function
Function .onInit
  Call CheckIfRunning
FunctionEnd

; Post-installation function
Function .onInstSuccess
  ; Register application in Windows Programs and Features
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "AI Development Team"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoRepair" 1

  ; Get installation size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "EstimatedSize" "$0"
FunctionEnd

; Uninstallation function
Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove ${PRODUCT_NAME} and all of its components?" IDYES +2
  Abort
FunctionEnd

Function un.onUninstSuccess
  ; Remove from startup
  Call un.RemoveFromStartup

  ; Remove file associations
  DeleteRegKey HKCR ".mainframe"
  DeleteRegKey HKCR "${PRODUCT_NAME}.Document"

  ; Remove uninstall information
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

  ; Clean up user data (optional - ask user)
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Do you want to remove user data and settings?" IDNO +3
    RMDir /r "$APPDATA\${PRODUCT_NAME}"
    RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
FunctionEnd

Function un.RemoveFromStartup
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
FunctionEnd

; Add custom page to installer
!insertmacro MUI_PAGE_CUSTOM CustomOptionsPage CustomOptionsPageLeave