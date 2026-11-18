# 把「长夜」传到 GitHub（从零开始）

你机器上 Git 已经装好了（2.55），GitHub 也能直连，不需要代理。
下面按顺序做，全流程大约 10 分钟。

---

## 第 1 步：注册 / 登录

打开 <https://github.com>，点右上角 **Sign up**。

1. 填邮箱 → 密码 → 用户名（用户名会出现在仓库地址里，比如 `zhangsan`，之后不能随便改）。
2. 邮箱会收到一封验证码，填进去。
3. 注册完自动登录。

已经有账号就点 **Sign in**。

---

## 第 2 步：建一个空仓库

登录后，右上角 **+** → **New repository**。

| 填什么 | 填成 |
| --- | --- |
| Repository name | `NightRead` |
| Description | 随便写或不写 |
| Public / Private | 想让人看见就 Public，只想自己用就 Private |
| Add a README file | **不要勾** |
| Add .gitignore | **不要选** |
| Choose a license | **不要选** |

⚠️ 那三个「不要」很重要：勾了仓库就不是空的，第一次推送会因为「远程有内容、本地没有」被拒绝。

点 **Create repository**，跳到仓库页。页面上有一串 `https://github.com/你的用户名/NightRead.git`，**复制它**，下一步要用。

---

## 第 3 步：一条命令把项目推上去

双击：

```
tools\push-github.bat
```

它会依次问你三件事：

1. **仓库地址** —— 粘贴刚才复制的 `https://github.com/你的用户名/NightRead.git`
2. **GitHub 用户名** —— 就是网址里那一段
3. **GitHub 邮箱** —— 注册用的邮箱，或者 `用户名@users.noreply.github.com`

然后它会自动：导出干净目录 → 初始化仓库 → 提交 → 推送。

**推送时会要求认证**，可能出现两种情况：

- **弹出浏览器窗口** → 点 **Sign in with your browser**，登录 GitHub，授权，窗口自己关掉，推送继续。这是最省事的情况。
- **命令行提示 `Username` / `Password`** →
  - Username 填你的 GitHub 用户名
  - Password **不能填登录密码**，要填 **Personal Access Token**，生成方法见下面第 4 步

推送成功后，刷新仓库页面就能看到所有文件。

---

## 第 4 步：生成 Token（只在命令行要密码时才需要）

1. 右上角头像 → **Settings**
2. 左侧拉到最下面 → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. 右上 **Generate new token** → **Generate new token (classic)**
5. Note 填 `nightread`，Expiration 选 90 days 或 No expiration
6. 勾选 **`repo`** 这一个就够了（它会把下面几个子项一起勾上）
7. 拉到最下 **Generate token**
8. 页面上出现一串 `ghp_xxxxxxxx`，**只显示这一次**，立刻复制存好

之后命令行要密码时，粘贴这串就行。Windows 会记住，下次不用再输。

---

## 第 5 步：以后每次更新

改完代码后：

```powershell
# 1. 打包（版本号在 android/build.ps1 和 AndroidManifest.xml 里改）
powershell -ExecutionPolicy Bypass -File android\build.ps1

# 2. 复制成发布包
copy android\build\nightread-v0.2.apk dist\NightRead.apk

# 3. 更新版本清单（版本号、版本名、更新说明、你的仓库地址）
python tools\release.py 19 0.16 "这次改了什么" https://github.com/你的用户名/NightRead

# 4. 推送（会记住上次的仓库地址，直接回车即可）
```

第 4 步就是再双击一次 `tools\push-github.bat`。

如果你在 GitHub 上打了 Release（仓库页 → Releases → Draft a new release → 选 tag `v0.16` → 把 `dist\NightRead-0.16.apk` 拖进去 → Publish），用户点更新提示里的「去下载」就会到这个页面。

---

## 第 6 步：让 App 检查更新

1. 手机上打开 App → 设置 → 关于
2. 「更新地址」填：

```
https://raw.githubusercontent.com/你的用户名/NightRead/main/version.json
```

3. 点「检查更新」

> 国内访问 `raw.githubusercontent.com` 有时会失败。打不开就把地址换成 jsDelivr 镜像：
> ```
> https://cdn.jsdelivr.net/gh/你的用户名/NightRead@main/version.json
> ```

以后只要 `version.json` 里的 `versionCode` 比手机上的大，App 就会提示有新版本。

---

## 常见问题

**推送报 `rejected — fetch first` / `non-fast-forward`**

建仓库时勾了 README 或 .gitignore，远程已经有内容。两种解法：

- 简单：把仓库删了，重新建一个**空的**。
- 或者先合并：在 `release-repo` 目录里执行
  ```bash
  git pull origin main --allow-unrelated-histories
  ```
  解决冲突后再 `git push -u origin main`。

**推送报 `Authentication failed`**

密码处填的可能是 GitHub 登录密码。要用第 4 步生成的 Token。

**`git push` 卡住不动**

网络问题。GitHub 走 443 端口，公司网络或代理可能拦。可以试试：
```bash
git config --global http.proxy http://127.0.0.1:7890
```
（端口换成你自己的代理端口；不需要代理时用 `git config --global --unset http.proxy` 取消）

**仓库会不会把聊天语料传上去？**

不会。`tools/export_repo.py` 只导出 `prototype/ android/ docs/ tools/ dist/` 和几个文件，`corpus/` 和 `deepseek_data-*.zip` 都被排除在外，`.gitignore` 里也写了。

**API Key 会不会被传上去？**

不会。Key 只存在手机本地的 `localStorage` 里，代码里没有任何 Key。

**能不能不公开？**

可以。建仓库时选 **Private**。注意：Private 仓库的 raw 链接需要带 token 才能访问，App 的更新检查就读不到了——这种情况改用 Release 页面链接手动下载，或者把仓库设为 Public。

---

## 命令速查（不想用脚本）

```bash
python tools\export_repo.py
cd release-repo
git init
git config user.name "你的用户名"
git config user.email "你的邮箱"
git add -A
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/NightRead.git
git push -u origin main
```
