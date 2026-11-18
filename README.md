# 长夜 NightRead

一个只属于自己的小说阅读 App：上传自己的稿子，由模型扮演读者在评论区说话。

安卓原生外壳（单 Activity + WebView）+ 纯前端页面，没有构建工具，没有第三方依赖。

## 目录

```
prototype/          App 的全部页面（HTML/CSS/JS），也是 WebView 加载的东西
android/            Android 外壳与打包脚本（无 Gradle）
  build.ps1         一键出包：aapt2 → javac → d8 → zipalign → apksigner
  java/             MainActivity：WebView、系统栏、HTTP 桥、相册选图
  AndroidManifest.xml
docs/               设计文档、提示词、测试计划
tools/              提示词试验台、语料分析脚本、发布脚本
dist/NightRead.apk  当前发布包
version.json        更新检查用的版本清单
```

## 打包

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\android\build.ps1
```

产物在 `android/build/nightread-v0.2.apk`，复制到 `dist/NightRead.apk` 即可发布。

依赖：Android SDK（build-tools 35、platform-34）、JDK 17+。不需要 Gradle。

## 发版流程

1. 改 `prototype/` 里的代码，改 `android/build.ps1` 和 `AndroidManifest.xml` 里的 `versionCode / versionName`。
2. 跑 `build.ps1`，把产物复制成 `dist/NightRead.apk`。
3. 跑 `python tools/release.py 18 0.15 "本次更新说明"`，它会：
   - 把 `dist/NightRead.apk` 的版本信息写进 `version.json`
   - 生成 `dist/NightRead-0.15.apk` 这个带版本号的副本
4. 提交并推送：
   ```bash
   git add -A
   git commit -m "v0.15"
   git push
   ```
5. 到 GitHub 打 Release（tag `v0.15`），把 `dist/NightRead-0.15.apk` 作为附件传上去。

> 也可以不建 Release，直接把 `dist/NightRead.apk` 提交进仓库——那样更新地址就是 raw 链接，省一步，但仓库会随每次发版变大。

## 更新检查

App 里「设置 → 关于」有一个「更新地址」输入框和「检查更新」按钮。

填这个：

```
https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/version.json
```

点检查后，App 读取 `version.json`，比较 `versionCode`：

```json
{
  "versionCode": 18,
  "versionName": "0.15",
  "apk": "https://github.com/<你>/<仓库>/releases/latest",
  "notes": "更新说明"
}
```

- 线上 `versionCode` 大于本机 → 弹出新版本说明和「去下载」（用系统浏览器打开 `apk` 链接）。
- 否则提示已是最新。

注意：`raw.githubusercontent.com` 在国内可能不稳定。如果打不开，可以换成 jsDelivr：

```
https://cdn.jsdelivr.net/gh/<你>/<仓库>@main/version.json
```

## 首次推到 GitHub

这个工作区里还放着别的东西（语料、其他项目），**不要在这里 `git init`**。先生成干净目录：

```powershell
python tools/export_repo.py
```

它只会导出 `prototype/ android/ docs/ tools/ dist/ README.md version.json .gitignore`，
不会带上 `corpus/`（聊天语料）和构建中间产物。然后：

```bash
cd release-repo
git init
git add -A
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你>/<仓库>.git
git push -u origin main
```

以后再发版：改代码 → `build.ps1` → 复制到 `dist/NightRead.apk` → `python tools/release.py …` → 重新 `export_repo.py` → 在那个目录里 `git add -A && git commit -m vX && git push`。

## 这个仓库里不该出现的东西

- `corpus/`、`deepseek_data-*.zip`：个人聊天记录。
- API Key：只存在手机本地 `localStorage`，代码里没有，也不要写进仓库。
