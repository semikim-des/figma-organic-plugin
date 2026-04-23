# 배포 가이드

이 문서는 플러그인을 사내에 배포하거나 GitHub에 반영하는 담당자를 위한 문서입니다.

## 배포 대상 파일

- `manifest.json`
- `code.js`
- `ui.html`
- `merged-react-figma.json`
- `README.md`
- `DEPLOYMENT_README.md`
- `MAINTENANCE_README.md`

## 사내 배포 방식

### 1. 공유 폴더 배포

1. 최신 플러그인 폴더를 사내 공유 폴더에 업로드합니다.
2. 팀원은 해당 폴더의 `manifest.json`으로 Figma에 등록합니다.
3. 기존과 같은 경로를 유지하면 재등록 없이 계속 사용할 수 있습니다.

### 2. GitHub 배포

이 프로젝트는 GitHub 원격 저장소와 연결되어 있습니다.

- 원격 저장소: `https://github.com/semikim-des/figma-organic-plugin`

## 빠른 배포 명령

수정한 내용을 바로 GitHub에 올리고 싶다면 아래 스크립트를 사용할 수 있습니다.

```bash
./deploy.sh "커밋 메시지"
```

터미널에서 메시지를 직접 입력하고 싶다면 인자 없이 실행하면 됩니다.

```bash
./deploy.sh
```

엔터만 누르면 현재 날짜와 시간 기준으로 자동 메시지가 들어갑니다.

더 짧게 쓰고 싶다면 아래 명령도 사용할 수 있습니다.

```bash
./gpush
```

필요하면 커밋 메시지를 바로 붙여도 됩니다.

```bash
./gpush "UI 문구 수정"
```

## 수동 배포 명령

```bash
git add .
git commit -m "커밋 메시지"
git push origin main
```

## 배포 전 체크리스트

- `manifest.json`이 최신인지 확인
- `code.js`가 최신인지 확인
- `ui.html`이 최신인지 확인
- 테스트용 불필요 파일이 포함되지 않았는지 확인
- `.DS_Store` 같은 운영체제 메타 파일이 없는지 확인

## 참고 사항

- Pro 플랜에서는 Figma 조직 비공개 플러그인 배포가 불가능합니다.
- 현재는 사내 공유 폴더 또는 GitHub 기반으로 배포하는 방식이 적합합니다.
