# Build APK: aapt2 -> javac -> d8 -> zip -> zipalign -> apksigner
$ErrorActionPreference = 'Stop'

$SDK   = 'C:\AndroidSdk'
$BT    = Join-Path $SDK 'build-tools\35.0.0'
$AJ    = Join-Path $SDK 'platforms\android-34\android.jar'
$ROOT  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROTO = Join-Path (Split-Path -Parent $ROOT) 'prototype'
$OUT   = Join-Path $ROOT 'build'

Write-Host "[1/7] sync web assets"
Copy-Item (Join-Path $PROTO 'index.html'), (Join-Path $PROTO 'app.css'), (Join-Path $PROTO 'app.js') (Join-Path $ROOT 'assets') -Force

Write-Host "[2/7] clean"
Remove-Item "$OUT","$ROOT\classes","$ROOT\dex","$ROOT\gen" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $OUT,"$ROOT\classes","$ROOT\gen","$ROOT\dex" | Out-Null

Write-Host "[3/7] aapt2 compile"
& "$BT\aapt2.exe" compile --dir (Join-Path $ROOT 'res') -o "$OUT\res.zip"
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

Write-Host "[4/7] aapt2 link"
& "$BT\aapt2.exe" link -o "$OUT\unsigned.apk" -I $AJ `
    --manifest (Join-Path $ROOT 'AndroidManifest.xml') `
    -R "$OUT\res.zip" --java "$ROOT\gen" -A (Join-Path $ROOT 'assets') `
    --min-sdk-version 24 --target-sdk-version 34 `
    --version-code 34 --version-name 0.31 --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host "[5/7] javac + d8"
$JSRCS = @(Get-ChildItem "$ROOT\java" -Recurse -Filter *.java | ForEach-Object { $_.FullName })
& javac -source 8 -target 8 -nowarn -classpath $AJ -d "$ROOT\classes" `
    "$ROOT\gen\com\nightread\app\R.java" @JSRCS
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }
& jar --create --file "$OUT\classes.jar" -C "$ROOT\classes" .
$ErrorActionPreference = 'Continue'
& "$BT\d8.bat" --lib $AJ --min-api 24 --release --output "$ROOT\dex" "$OUT\classes.jar"
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

Write-Host "[6/7] package + align"
python -c "import zipfile,shutil;shutil.copyfile(r'$OUT\unsigned.apk',r'$OUT\withdex.apk');z=zipfile.ZipFile(r'$OUT\withdex.apk','a',zipfile.ZIP_DEFLATED);z.write(r'$ROOT\dex\classes.dex','classes.dex');z.close()"
& "$BT\zipalign.exe" -f -p 4 "$OUT\withdex.apk" "$OUT\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

Write-Host "[7/7] sign"
$ks = Join-Path $ROOT 'debug.keystore'
if (-not (Test-Path $ks)) {
    $ErrorActionPreference = 'Continue'
    & keytool -genkeypair -keystore $ks -alias nightread -storepass nightread -keypass nightread `
        -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=NightRead, OU=Proto, O=NightRead, L=Shanghai, C=CN"
    $ErrorActionPreference = 'Stop'
}
$ErrorActionPreference = 'Continue'
& "$BT\apksigner.bat" sign --ks $ks --ks-pass pass:nightread --key-pass pass:nightread --out "$OUT\nightread-v0.2.apk" "$OUT\aligned.apk"
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }

$ErrorActionPreference = 'Continue'
& "$BT\apksigner.bat" verify "$OUT\nightread-v0.2.apk"
$ver = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($ver -ne 0) { throw 'verify failed' }

$f = Get-Item "$OUT\nightread-v0.2.apk"
Write-Host ("DONE " + $f.FullName + "  " + [math]::Round($f.Length/1KB,1) + " KB")

