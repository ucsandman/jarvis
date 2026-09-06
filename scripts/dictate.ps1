param([string]$AudioFile)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$sidelookSpeech = [System.Speech.Recognition.SpeechRecognitionEngine]::new([System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
try {
    $sidelookSpeech.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
    $sidelookSpeech.InitialSilenceTimeout = [TimeSpan]::FromSeconds(12)
    $sidelookSpeech.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(900)
    if ($AudioFile) { $sidelookSpeech.SetInputToWaveFile($AudioFile) }
    else { $sidelookSpeech.SetInputToDefaultAudioDevice() }
    $sidelookUtterance = $sidelookSpeech.Recognize([TimeSpan]::FromSeconds(25))
    @{ text = $(if ($sidelookUtterance) { $sidelookUtterance.Text } else { '' }); local = $true } | ConvertTo-Json -Compress
} finally { $sidelookSpeech.Dispose() }
