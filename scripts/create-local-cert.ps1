param(
  [string]$OutDir = ".cert",
  [string]$Passphrase = "linx-local-dev"
)

$ErrorActionPreference = "Stop"

function Get-LocalIPv4Addresses {
  $addresses = New-Object System.Collections.Generic.List[string]
  $addresses.Add("127.0.0.1")

  [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object { $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up } |
    ForEach-Object {
      $_.GetIPProperties().UnicastAddresses |
        Where-Object {
          $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
          -not [System.Net.IPAddress]::IsLoopback($_.Address) -and
          -not $_.Address.ToString().StartsWith("169.254.")
        } |
        ForEach-Object {
          $address = $_.Address.ToString()
          if (-not $addresses.Contains($address)) {
            $addresses.Add($address)
          }
        }
    }

  return $addresses.ToArray()
}

$resolvedOutDir = Join-Path (Get-Location) $OutDir
New-Item -ItemType Directory -Force -Path $resolvedOutDir | Out-Null

$caCer = Join-Path $resolvedOutDir "linx-local-root-ca.cer"
$serverPfx = Join-Path $resolvedOutDir "linx-local-server.pfx"
$serverCer = Join-Path $resolvedOutDir "linx-local-server.cer"
$metaPath = Join-Path $resolvedOutDir "https-local.json"
$ips = Get-LocalIPv4Addresses
$hostName = [System.Net.Dns]::GetHostName()

$sanParts = New-Object System.Collections.Generic.List[string]
$sanParts.Add("DNS=localhost")
$sanParts.Add("DNS=$hostName")
$sanParts.Add("DNS=$hostName.local")
foreach ($ip in $ips) {
  $sanParts.Add("IPAddress=$ip")
}
$sanText = "2.5.29.17={text}$($sanParts -join '&')"

$rootCa = New-SelfSignedCertificate `
  -Type Custom `
  -Subject "CN=LinX Local Root CA" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage CertSign, CRLSign `
  -NotBefore (Get-Date).AddDays(-1) `
  -NotAfter (Get-Date).AddYears(10) `
  -TextExtension @(
    "2.5.29.19={critical}{text}ca=TRUE&pathlength=0"
  )

$serverCert = New-SelfSignedCertificate `
  -Type Custom `
  -Subject "CN=LinX Local HTTPS" `
  -Signer $rootCa `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature, KeyEncipherment `
  -NotBefore (Get-Date).AddDays(-1) `
  -NotAfter (Get-Date).AddDays(365) `
  -TextExtension @(
    $sanText,
    "2.5.29.19={critical}{text}ca=FALSE",
    "2.5.29.37={text}1.3.6.1.5.5.7.3.1"
  )

$securePassword = ConvertTo-SecureString -String $Passphrase -AsPlainText -Force
Export-PfxCertificate -Cert $serverCert -FilePath $serverPfx -Password $securePassword -Force | Out-Null
Export-Certificate -Cert $rootCa -FilePath $caCer -Force | Out-Null
Export-Certificate -Cert $serverCert -FilePath $serverCer -Force | Out-Null

try {
  Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($serverCert.Thumbprint)" -Force
  Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($rootCa.Thumbprint)" -Force
} catch {
  Write-Warning "Certificate was exported but could not be removed from CurrentUser\My: $($_.Exception.Message)"
}

$meta = [ordered]@{
  ips = $ips
  dnsNames = @("localhost", $hostName, "$hostName.local")
  caCertificate = $caCer
  serverCertificate = $serverPfx
  passphraseEnv = "LOCAL_CERT_PASSPHRASE"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
}

$metaJson = $meta | ConvertTo-Json -Depth 4
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($metaPath, $metaJson, $utf8NoBom)

Write-Host "Local HTTPS certificate generated:"
Write-Host "  Root CA to install/trust:  $caCer"
Write-Host "  Server PFX:                $serverPfx"
Write-Host "  DNS SAN:                   localhost, $hostName, $hostName.local"
Write-Host "  IP SAN:                    $($ips -join ', ')"
