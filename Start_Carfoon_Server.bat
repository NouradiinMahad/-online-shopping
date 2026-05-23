@echo off
title Carfoon Server [PORT 3000]
echo ==============================================
echo [ CARFOON SERVER ] is booting up...
echo ==============================================
echo.
echo Your local network link for mobile is:
echo http://192.168.100.7:3000
echo.
echo WARNING: Do not close this window! If you close it, your phone will lose connection.
echo ==============================================
echo.
python server.py
pause
