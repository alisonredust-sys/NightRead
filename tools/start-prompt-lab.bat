@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 提示词试验台
echo.
echo   提示词试验台
echo   启动后窗口不要关，关了服务就停。
echo.
where python >nul 2>nul
if %errorlevel%==0 (
    python prompt_lab.py
    goto :end
)
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 prompt_lab.py
    goto :end
)
echo   没有找到 Python。请先安装 Python 3，或把 python.exe 加到 PATH。
:end
echo.
echo   服务已停止，按任意键关闭。
pause >nul
