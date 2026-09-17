<img width="2032" height="1099" alt="스크린샷 2026-09-03 12 13 41" src="https://github.com/user-attachments/assets/7b3b0857-23ef-4ef9-be79-f1dd47dc0a70" />

개발 확인 (Node.js 22.13 이상):

```sh
npm test
npm run build
npm run tauri -- build --debug --no-bundle -- --offline
```

회귀 테스트는 메모리 SQLite와 DOM 어댑터를 사용하며, 사용자 DB를 수정하지 않습니다. 실제 Tauri 화면의 드래그 및 편집 동작은 별도로 확인해야 합니다.
