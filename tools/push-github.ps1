# -*- coding: utf-8 -*-
"""生成 release-repo/ 并推到 GitHub。第一次运行会引导你填仓库地址和身份。

用法：双击 tools\push-github.bat，或在 PowerShell 里：
    powershell -ExecutionPolicy Bypass -File tools\push-github.ps1
"""
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ''
Write-Host '======== 推送到 GitHub ========' -ForegroundColor Cyan
Write-Host ''

# 1. 仓库地址
$saved = Join-Path $root '.repo-url'
if (Test-Path $saved) {
    $repoUrl = (Get-Content $saved -Raw).Trim()
    Write-Host ("仓库地址（上次用的）：" + $repoUrl)
    $ans = Read-Host '回车沿用，或粘贴新的仓库地址'
    if ($ans.Trim()) { $repoUrl = $ans.Trim() }
} else {
    Write-Host '粘贴仓库地址，形如 https://github.com/你的用户名/NightRead.git'
    $repoUrl = (Read-Host '仓库地址').Trim()
}
if (-not $repoUrl) { Write-Host '没有地址，退出。' -ForegroundColor Red; exit 1 }
$repoUrl | Set-Content -Path $saved -NoNewline

# 2. 身份（只写进这个仓库，不改全局）
$userName = Read-Host 'GitHub 用户名'
$userEmail = Read-Host 'GitHub 邮箱（可用 用户名@users.noreply.github.com）'
if (-not $userName) { Write-Host '用户名不能为空。' -ForegroundColor Red; exit 1 }
if (-not $userEmail) { $userEmail = "$userName@users.noreply.github.com" }

# 3. 导出干净目录
Write-Host ''
Write-Host '→ 导出 App 文件…' -ForegroundColor Yellow
python tools\export_repo.py | Out-Null

$dst = Join-Path $root 'release-repo'
Set-Location $dst

# 4. 初始化仓库
if (-not (Test-Path '.git')) {
    Write-Host '→ git init' -ForegroundColor Yellow
    git init | Out-Null
}
git config user.name $userName
git config user.email $userEmail

$msg = "update " + (Get-Date -Format 'yyyy-MM-dd HH:mm')
git add -A
git commit -m $msg 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host '（没有新改动，继续推送）' }

git branch -M main

$exists = (git remote 2>$null) -contains 'origin'
if ($exists) {
    git remote set-url origin $repoUrl
} else {
    git remote add origin $repoUrl
}

# 5. 推送
Write-Host ''
Write-Host '→ 开始推送…' -ForegroundColor Yellow
Write-Host '   如果弹出浏览器登录窗，直接登录 GitHub 即可。' -ForegroundColor DarkGray
Write-Host '   如果命令行要密码，粘贴 Personal Access Token（不是登录密码）。' -ForegroundColor DarkGray
Write-Host ''
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host '推送完成。' -ForegroundColor Green
    Write-Host ("仓库：" + $repoUrl.Replace('.git', ''))
} else {
    Write-Host ''
    Write-Host '推送失败。常见原因：' -ForegroundColor Red
    Write-Host '  1. 仓库地址拼错（要以 .git 结尾）'
    Write-Host '  2. 认证失败 —— 密码处要粘贴 Token，不是 GitHub 登录密码'
    Write-Host '  3. 仓库里已经有内容（建仓库时勾了 README）—— 见 docs/github-guide.md 的"常见问题"'
}

Set-Location $root
Write-Host ''
Read-Host '按回车关闭'
