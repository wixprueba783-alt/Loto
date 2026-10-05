Option Explicit

Dim shell, fileSystem, serviceDirectory, runnerPath, exitCode

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
serviceDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
runnerPath = fileSystem.BuildPath(serviceDirectory, "run-with-logs.js")
shell.CurrentDirectory = serviceDirectory

Do
  exitCode = shell.Run("node.exe """ & runnerPath & """", 0, True)
  WScript.Sleep 60000
Loop
