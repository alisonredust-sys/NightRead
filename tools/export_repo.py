# -*- coding: utf-8 -*-
"""把 App 相关文件导出成一个干净的目录，供 git init / push 到 GitHub。

    python tools/export_repo.py [目标目录]

只导出 App 真正需要的东西：页面、原生外壳、文档、发布包、版本清单。
临时补丁脚本、语料、构建中间产物都不会带出去。
"""
import io
import os
import shutil
import sys

ROOT = r'L:\HarnessTest20260904'

# 原样整目录带走的
TREES = [
    'prototype',
    'docs',
    'android/java',
    'android/res',
]

# dist 只带安装包，测试截图和过程图不带
DIST_EXT = ('.apk',)

# 只挑这几个文件带走的目录
PICK = {
    'android': ['build.ps1', 'AndroidManifest.xml'],
    'tools': ['prompts.py', 'prompt_lab.py', 'start-prompt-lab.bat',
              'export_repo.py', 'release.py', 'push-github.ps1', 'push-github.bat'],
}

ROOT_FILES = ['README.md', 'version.json', '.gitignore']

SKIP_DIRS = {'build', '__pycache__', 'tmp', 'node_modules', '.git'}
SKIP_EXT = {'.pyc', '.class', '.dex'}


def copy_tree(src, dst):
    for name in os.listdir(src):
        if name in SKIP_DIRS:
            continue
        sp = os.path.join(src, name)
        dp = os.path.join(dst, name)
        if os.path.isdir(sp):
            os.makedirs(dp, exist_ok=True)
            copy_tree(sp, dp)
        else:
            ext = os.path.splitext(name)[1].lower()
            if ext in SKIP_EXT or name.endswith('.zip') or name.startswith('deepseek_data'):
                continue
            shutil.copyfile(sp, dp)


def main():
    dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'release-repo')

    # 保留 .git，避免每次导出都清掉提交历史
    if os.path.isdir(dst):
        for name in os.listdir(dst):
            if name == '.git':
                continue
            p = os.path.join(dst, name)
            if os.path.isdir(p):
                shutil.rmtree(p)
            else:
                os.remove(p)
    os.makedirs(dst, exist_ok=True)

    # dist：只带 .apk
    dist_src = os.path.join(ROOT, 'dist')
    dist_dst = os.path.join(dst, 'dist')
    if os.path.isdir(dist_src):
        os.makedirs(dist_dst, exist_ok=True)
        for fn in os.listdir(dist_src):
            if fn.lower().endswith(DIST_EXT):
                shutil.copyfile(os.path.join(dist_src, fn), os.path.join(dist_dst, fn))

    for rel in TREES:
        src = os.path.join(ROOT, rel.replace('/', os.sep))
        if not os.path.isdir(src):
            continue
        out = os.path.join(dst, rel.replace('/', os.sep))
        os.makedirs(out, exist_ok=True)
        copy_tree(src, out)

    for rel, names in PICK.items():
        src = os.path.join(ROOT, rel)
        out = os.path.join(dst, rel)
        os.makedirs(out, exist_ok=True)
        for fn in names:
            sp = os.path.join(src, fn)
            if os.path.exists(sp):
                shutil.copyfile(sp, os.path.join(out, fn))

    for fn in ROOT_FILES:
        sp = os.path.join(ROOT, fn)
        if os.path.exists(sp):
            shutil.copyfile(sp, os.path.join(dst, fn))

    total = 0
    size = 0
    for base, _, files in os.walk(dst):
        if '.git' in base:
            continue
        for fn in files:
            total += 1
            size += os.path.getsize(os.path.join(base, fn))
    print('已导出到：' + dst)
    print('文件 %d 个，共 %.1f MB' % (total, size / 1024.0 / 1024.0))
    print('')
    print('接下来运行 tools\\push-github.bat 推送，或按 docs\\github-guide.md 手动操作。')


if __name__ == '__main__':
    main()
