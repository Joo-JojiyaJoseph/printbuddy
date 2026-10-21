' Starts run-agent.bat with no window.
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & here & "\run-agent.bat""", 0, False
