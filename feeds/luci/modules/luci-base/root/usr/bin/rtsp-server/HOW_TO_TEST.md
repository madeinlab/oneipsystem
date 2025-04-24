// 테스트 환경
  카메라는 1번 포트에 연결. 'rtsp 인증 사용' 설정

// rtsp proxy 서버 실행
  cd /usr/bin/rtsp-server
  ./mediamtx mediamtx.yml

// vlc 에서 접속
  rtsp://192.168.1.100:10554/camera1 로 접속요청

// proxy url 변환 (mediamtx.yml에서 설정)
  camera1: rtsp://admin:admin1357@209.142.67.10:554/media/1/2/Profile2

// vlc 영상 확인
  1번 카메라 영상 출력 확인.
  profile2 확인. 