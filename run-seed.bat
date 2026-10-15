@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nahi mila. Pehle https://nodejs.org se LTS version install karo.
  pause
  exit /b
)
set /p PW=Atlas database password daalo (sirf letters/numbers): 
set "MONGO_URI=mongodb+srv://srivastavashrija620_db_user:%PW%@cluster0.zbuuq8u.mongodb.net/?appName=Cluster0"
call npm install
call node seed.js indian_pharmaceutical_products_clean.csv
echo.
echo Khatam. Upar ka Done line dekho.
pause
