param([string]$AudioFile)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$jarvisSpeech = [System.Speech.Recognition.SpeechRecognitionEngine]::new([System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
try {
    $jarvisSpeech.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
    $jarvisSpeech.InitialSilenceTimeout = [TimeSpan]::FromSeconds(12)
    $jarvisSpeech.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(900)
    if ($AudioFile) { $jarvisSpeech.SetInputToWaveFile($AudioFile) }
    else { $jarvisSpeech.SetInputToDefaultAudioDevice() }
    $jarvisUtterance = $jarvisSpeech.Recognize([TimeSpan]::FromSeconds(25))
    @{ text = $(if ($jarvisUtterance) { $jarvisUtterance.Text } else { '' }); local = $true } | ConvertTo-Json -Compress
} finally { $jarvisSpeech.Dispose() }
