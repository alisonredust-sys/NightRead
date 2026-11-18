# -*- coding: utf-8 -*-
"""发版助手：把 dist/NightRead.apk 的版本信息写进 version.json，并生成带版本号的副本。

用法：
    python tools/release.py <versionCode> <versionName> "<更新说明>" [仓库地址]
"""
import io
import json
import os
import shutil
import sys

ROOT = r'L:\HarnessTest20260904'
APK = os.path.join(ROOT, 'dist', 'NightRead.apk')


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    code = int(sys.argv[1])
    name = sys.argv[2]
    notes = sys.argv[3]
    repo = sys.argv[4] if len(sys.argv) > 4 else 'https://github.com/USER/REPO'

    if not os.path.exists(APK):
        print('找不到 dist/NightRead.apk，先跑 build.ps1')
        return 1

    meta = {
        'versionCode': code,
        'versionName': name,
        'apk': repo.rstrip('/') + '/releases/latest',
        'page': repo.rstrip('/') + '/releases/latest',
        'notes': notes,
    }
    with io.open(os.path.join(ROOT, 'version.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write('\n')

    dst = os.path.join(ROOT, 'dist', 'NightRead-%s.apk' % name)
    shutil.copyfile(APK, dst)
    print('version.json 已更新：v%s (%d)' % (name, code))
    print('副本：' + dst)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
