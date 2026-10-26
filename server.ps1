# ALTISEC REPORT AUTOMATION STUDIO - POWERSHELL HTTP SERVER
param (
    [int]$Port = 8000
)

$PublicDir = $PSScriptRoot
$PublicRoot = [System.IO.Path]::GetFullPath($PublicDir).TrimEnd('\') + '\'
$TemplatesStorePath = Join-Path $PublicDir "custom_templates_store.json"

$MimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".docx"  = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
}

function Get-TemplatesStore {
    if (Test-Path $TemplatesStorePath) {
        try {
            $raw = Get-Content -Path $TemplatesStorePath -Raw -Encoding UTF8
            if ($raw) {
                return $raw | ConvertFrom-Json
            }
        } catch {
            Write-Host "[Template Store] Read Error: $_"
        }
    }
    return [PSCustomObject]@{ templates = @(); customers = @() }
}

function Save-TemplatesStore ($data) {
    try {
        $json = $data | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($TemplatesStorePath, $json, [System.Text.Encoding]::UTF8)
        return $true
    } catch {
        Write-Host "[Template Store] Save Error: $_"
        return $false
    }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    Write-Error "Failed to start HttpListener: $_"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  AltiSec Report Automation Studio is LIVE!" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$Port/" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl
        $safeUrl = $rawUrl.Split('?')[0]

        # REST API Endpoints
        if ($safeUrl -eq "/api/templates" -and $request.HttpMethod -eq "GET") {
            $store = Get-TemplatesStore
            $resObj = [PSCustomObject]@{
                success = $true
                templates = $store.templates
                customers = $store.customers
            }
            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Depth 20))
            $response.ContentType = "application/json; charset=utf-8"
            $response.StatusCode = 200
            $response.ContentLength64 = $jsonBytes.Length
            $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
            $response.Close()
            continue
        }

        if ($safeUrl -eq "/api/templates/save" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $payload = $body | ConvertFrom-Json
            $tpl = if ($payload.template) { $payload.template } else { $payload }

            $store = Get-TemplatesStore
            $templatesList = [System.Collections.ArrayList]@($store.templates)
            $customersList = [System.Collections.ArrayList]@($store.customers)

            $existingIdx = -1
            for ($i = 0; $i -lt $templatesList.Count; $i++) {
                if ($templatesList[$i].id -eq $tpl.id) {
                    $existingIdx = $i
                    break
                }
            }

            if ($existingIdx -ge 0) {
                $templatesList[$existingIdx] = $tpl
            } else {
                $templatesList.Insert(0, $tpl)
            }

            if ($tpl.customer -and -not ($customersList -contains $tpl.customer)) {
                $customersList.Add($tpl.customer) | Out-Null
            }
            if ($payload.customer -and -not ($customersList -contains $payload.customer)) {
                $customersList.Add($payload.customer) | Out-Null
            }

            $store.templates = $templatesList
            $store.customers = $customersList
            Save-TemplatesStore $store | Out-Null

            $resObj = [PSCustomObject]@{
                success = $true
                template = $tpl
                templates = $store.templates
                customers = $store.customers
            }
            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Depth 20))
            $response.ContentType = "application/json; charset=utf-8"
            $response.StatusCode = 200
            $response.ContentLength64 = $jsonBytes.Length
            $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
            $response.Close()
            continue
        }

        if ($safeUrl -eq "/api/templates/delete" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $payload = $body | ConvertFrom-Json
            $id = $payload.id

            $store = Get-TemplatesStore
            $filtered = @($store.templates) | Where-Object { $_.id -ne $id }
            $store.templates = $filtered
            Save-TemplatesStore $store | Out-Null

            $resObj = [PSCustomObject]@{
                success = $true
                templates = $store.templates
            }
            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Depth 20))
            $response.ContentType = "application/json; charset=utf-8"
            $response.StatusCode = 200
            $response.ContentLength64 = $jsonBytes.Length
            $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
            $response.Close()
            continue
        }

        if ($safeUrl -eq "/api/customers/add" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $payload = $body | ConvertFrom-Json
            $customerName = if ($payload.name) { $payload.name } else { $payload.customer }

            $store = Get-TemplatesStore
            $customersList = [System.Collections.ArrayList]@($store.customers)
            if ($customerName -and -not ($customersList -contains $customerName)) {
                $customersList.Add($customerName) | Out-Null
                $store.customers = $customersList
                Save-TemplatesStore $store | Out-Null
            }

            $resObj = [PSCustomObject]@{
                success = $true
                customers = $store.customers
            }
            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Depth 20))
            $response.ContentType = "application/json; charset=utf-8"
            $response.StatusCode = 200
            $response.ContentLength64 = $jsonBytes.Length
            $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        $decodedUrl = [System.Uri]::UnescapeDataString($safeUrl.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($decodedUrl)) {
            $decodedUrl = "index.html"
        }

        $localPath = Join-Path $PublicDir $decodedUrl

        # Prevent directory traversal (mirrors server.js): resolved path must stay inside the app folder
        try { $localPath = [System.IO.Path]::GetFullPath($localPath) } catch { $localPath = $null }
        if (-not $localPath -or -not ($localPath + '\').StartsWith($PublicRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $forbiddenBytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $response.StatusCode = 403
            $response.ContentLength64 = $forbiddenBytes.Length
            $response.OutputStream.Write($forbiddenBytes, 0, $forbiddenBytes.Length)
            $response.Close()
            continue
        }

        if (Test-Path $localPath -PathType Container) {
            $localPath = Join-Path $localPath "index.html"
        }

        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentType = $mime
            $response.StatusCode = 200
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Not Found</h1>")
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $notFoundBytes.Length
            $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }

        $response.Close()
    } catch {
        # Keep listening even on transient error
    }
}
