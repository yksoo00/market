@echo off
rem 더블클릭 한 번으로 실행: main 최신화, Docker 확인, DB·Redis·백엔드(컨테이너), 프론트(pnpm dev), 브라우저.
rem 백엔드는 실행 PC 에 JDK 가 없어도 되도록 compose 의 api-dev 컨테이너로 띄운다.
rem 한글 출력 때문에 UTF-8(BOM 없음) + CRLF 로 저장한다 (.gitattributes). LF 면 cmd 가 goto 라벨을 못 찾는다.
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "FRONT_URL=http://localhost:3000"
set "HEALTH_URL=http://localhost:8080/actuator/health"
set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"

echo.
echo [1/5] 필요한 프로그램 확인
where git >nul 2>&1
if errorlevel 1 set "MSG=git 이 설치되어 있지 않습니다." & goto :fail
where docker >nul 2>&1
if errorlevel 1 set "MSG=Docker Desktop 이 설치되어 있지 않습니다." & goto :fail
where pnpm >nul 2>&1
if errorlevel 1 set "MSG=pnpm 이 설치되어 있지 않습니다." & goto :fail
if not exist ".env" set "MSG=.env 파일이 없습니다. 개발자에게 받아 이 폴더에 두세요." & goto :fail

echo.
echo [2/5] 최신 코드 받기 (main)
set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if /i "%BRANCH%"=="main" goto :pull
echo   지금 브랜치가 %BRANCH% 입니다. main 으로 바꿉니다.
git switch main
rem 바꾸지 못했으면(수정한 파일이 있는 등) 다른 브랜치에 main 을 끌어오지 않도록 받기를 건너뛴다
if errorlevel 1 goto :pull_failed
:pull
git pull --ff-only origin main
if errorlevel 1 goto :pull_failed
goto :docker
:pull_failed
echo.
echo   [주의] 최신 코드를 받지 못했습니다. 지금 있는 코드로 계속합니다.
echo          이 창의 메시지를 개발자에게 알려 주세요. (로컬 수정은 지우지 않았습니다)
timeout /t 10

:docker
echo.
echo [3/5] Docker 확인
docker info >nul 2>&1
if not errorlevel 1 goto :services
if not exist "%DOCKER_EXE%" set "MSG=Docker Desktop 실행 파일을 찾지 못했습니다. 직접 켠 뒤 다시 실행하세요." & goto :fail
echo   Docker Desktop 을 켭니다. 1~2분 걸릴 수 있습니다.
start "" "%DOCKER_EXE%"
set /a TRIES=0
:wait_docker
rem timeout 은 입력을 받을 수 없는 창에서 바로 끝나 버려 ping 으로 3초 쉰다
ping -n 4 127.0.0.1 >nul
docker info >nul 2>&1
if not errorlevel 1 goto :services
set /a TRIES+=1
if %TRIES% lss 60 goto :wait_docker
set "MSG=Docker 가 3분 안에 켜지지 않았습니다. Docker Desktop 창을 확인하세요." & goto :fail

:services
echo.
echo [4/5] DB·Redis·백엔드 켜기
rem --build: 받은 코드가 바뀌었을 때만 이미지를 다시 만들고 컨테이너를 바꾼다. 그대로면 켜져 있는 것을 둔다
rem postgres·redis 는 api-dev 의 depends_on(healthy) 으로 같이 켜진다
docker compose --profile dev up -d --build api-dev
if errorlevel 1 set "MSG=컨테이너를 켜지 못했습니다. 위 메시지를 개발자에게 알려 주세요." & goto :fail
echo   백엔드 준비 기다리는 중... (처음 한 번은 의존성 내려받기로 5분 이상 걸릴 수 있습니다)
set /a TRIES=0
:wait_backend
curl -s --max-time 3 "%HEALTH_URL%" 2>nul | findstr /c:"UP" >nul
if not errorlevel 1 goto :frontend
set /a TRIES+=1
if %TRIES% geq 200 goto :backend_timeout
ping -n 4 127.0.0.1 >nul
goto :wait_backend
:backend_timeout
docker compose --profile dev logs --tail 40 api-dev
set "MSG=백엔드가 10분 안에 준비되지 않았습니다. 위 로그를 개발자에게 알려 주세요." & goto :fail

:frontend
echo   백엔드 준비 완료.
echo.
echo [5/5] 프론트 켜기
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if not errorlevel 1 echo   이미 켜져 있습니다. & goto :open
pushd frontend
call pnpm install --frozen-lockfile
if errorlevel 1 popd & set "MSG=프론트 의존성 설치에 실패했습니다." & goto :fail
popd
rem 따로 창을 띄워 둔다. 그 창을 닫으면 프론트가 꺼진다
start "market-frontend" /d "%~dp0frontend" cmd /k pnpm dev
echo   프론트 준비 기다리는 중...
set /a TRIES=0
:wait_front
curl -s -o nul --max-time 60 "%FRONT_URL%" >nul 2>&1
if not errorlevel 1 goto :open
set /a TRIES+=1
if %TRIES% geq 60 set "MSG=프론트가 준비되지 않았습니다. market-frontend 창의 메시지를 확인하세요." & goto :fail
ping -n 4 127.0.0.1 >nul
goto :wait_front

:open
start "" "%FRONT_URL%"
echo.
echo ==========================================================
echo   실행 완료: %FRONT_URL%
echo   market-frontend 창은 닫지 마세요 (닫으면 화면이 꺼집니다).
echo   이 창은 닫아도 됩니다.
echo ==========================================================
timeout /t 15
exit /b 0

:fail
echo.
echo   [실패] %MSG%
echo.
pause
exit /b 1
