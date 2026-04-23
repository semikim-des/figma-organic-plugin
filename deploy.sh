#!/bin/zsh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "이 폴더는 Git 저장소가 아닙니다."
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [ -z "$BRANCH" ]; then
  echo "현재 브랜치를 확인할 수 없습니다."
  exit 1
fi

DEFAULT_MESSAGE="자동 업데이트: $(date '+%Y-%m-%d %H:%M:%S')"

if [ $# -gt 0 ]; then
  COMMIT_MESSAGE="$*"
else
  print -n "수정사항을 입력하세요 (비우면 자동 메시지 사용): "
  read -r USER_MESSAGE

  if [ -n "${USER_MESSAGE// /}" ]; then
    COMMIT_MESSAGE="$USER_MESSAGE"
  else
    COMMIT_MESSAGE="$DEFAULT_MESSAGE"
  fi
fi

if [ -n "$(git status --short)" ]; then
  git add .
  git commit -m "$COMMIT_MESSAGE"
  git push origin "$BRANCH"
  echo "GitHub 업데이트 완료: $BRANCH"
else
  echo "커밋할 변경사항이 없습니다."
fi
