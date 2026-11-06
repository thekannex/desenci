# Desenci tek dosyasını (release/Desenci.html) FTP ile sunucuya yükler: sitede index.html ve indirilebilir Desenci.html.
# Kullanım: önce "npm run build", sonra "npm run upload:web".
# Parola ilk yüklemede sorulur ve Windows'un kendi şifrelemesiyle (yalnız bu kullanıcı açabilir) saklanır;
# sonraki yüklemelerde sorulmaz. Saklanan parolayı silmek için: -ForgetPassword
# Bağlantı şifrelidir (FTPS). Sunucunun sertifikası Hostinger adına (*.hstgr.io) olduğu için bağlantı
# ftp.kannex.pro'nun adresine o adla kurulur; sertifika yine tam olarak denetlenir.
param(
  [string]$Server = 'ftp.kannex.pro',
  [string]$User = 'u405717589.desenci',
  # FTP hesabının kök klasörüne göre hedef (hesap doğrudan sitenin klasörüne açılıyor)
  [string]$RemoteDir = '/',
  [string]$SiteUrl = 'https://kannex.pro/desenci/',
  # Sertifikadaki ad
  [string]$TlsName = 'ftp.hstgr.io',
  [switch]$ForgetPassword
)
$ErrorActionPreference = 'Stop'

$credFile = Join-Path $env:APPDATA "Desenci\ftp-$($User -replace '[^A-Za-z0-9._-]', '_').xml"
if ($ForgetPassword) {
  if (Test-Path $credFile) { Remove-Item $credFile -Force -Confirm:$false }
  Write-Host 'Saklanan FTP parolası silindi.'
  exit 0
}

$source = Join-Path $PSScriptRoot '..\release\Desenci.html'
if (-not (Test-Path $source)) {
  Write-Host 'release\Desenci.html bulunamadı. Önce "npm run build" çalıştırın.' -ForegroundColor Red
  exit 1
}
$source = (Resolve-Path $source).Path
if (-not $RemoteDir.EndsWith('/')) { $RemoteDir += '/' }
if (-not $RemoteDir.StartsWith('/')) { $RemoteDir = '/' + $RemoteDir }

# Program tek dosya: indirilebilir kopya (Desenci.html) ve sitenin giriş sayfası (index.html)
$files = @(@{ Path = $source; Name = 'Desenci.html' }, @{ Path = $source; Name = 'index.html' })

$ip = ([System.Net.Dns]::GetHostAddresses($Server) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1).IPAddressToString
if (-not $ip) { Write-Host "$Server adresi bulunamadı (internet bağlantısını denetleyin)." -ForegroundColor Red; exit 1 }

Write-Host "Sunucu: $Server ($ip)   Kullanıcı: $User   Hedef: $RemoteDir"
Write-Host "$($files.Count) dosya yüklenecek."

$saved = $false
if (Test-Path $credFile) {
  $secure = Import-Clixml $credFile
  $saved = $true
} else {
  $secure = Read-Host 'FTP parolası' -AsSecureString
}
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$pass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
# Parola komut satırında görünmesin diye curl'e ayar olarak girişten verilir
$esc = ("$User`:$pass").Replace('\', '\\').Replace('"', '\"')
$config = "user = `"$esc`""
$pass = $null

$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
$i = 0
foreach ($f in $files) {
  $i++
  $rel = $f.Name
  $url = "ftp://$TlsName$RemoteDir$rel"
  Write-Host ("[{0}/{1}] {2}" -f $i, $files.Count, $rel)
  $config | & $curl -s -S --ssl-reqd --ftp-create-dirs --connect-timeout 20 --resolve "${TlsName}:21:$ip" -K - -T $f.Path $url
  if ($LASTEXITCODE -eq 67) {
    Write-Host 'Kullanıcı adı ya da parola yanlış.' -ForegroundColor Red
    if ($saved) { Remove-Item $credFile -Force -Confirm:$false; Write-Host 'Saklanan parola silindi; bir sonraki yüklemede yeniden sorulur.' }
    exit 1
  }
  if ($LASTEXITCODE -ne 0) { Write-Host "Yüklenemedi: $rel (curl çıkış kodu $LASTEXITCODE)" -ForegroundColor Red; exit 1 }
}

# İlk başarılı yüklemeden sonra parola saklanır (DPAPI: yalnız bu Windows kullanıcısı açabilir)
if (-not $saved) {
  New-Item -ItemType Directory -Force (Split-Path $credFile) | Out-Null
  $secure | Export-Clixml $credFile
  Write-Host 'Parola bu bilgisayarda şifreli olarak saklandı; sonraki yüklemelerde sorulmayacak.'
}
Write-Host ''
Write-Host "Yükleme tamam. Adres: $SiteUrl" -ForegroundColor Green
