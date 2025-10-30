@echo off
echo Starting Graph Plotter server...
cd /d "%~dp0"
python -m http.server 8080
pause

