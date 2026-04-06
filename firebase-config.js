// ============================================================
// Firebase設定ファイル
// ============================================================
// セットアップ手順:
// 1. https://console.firebase.google.com/ にアクセス
// 2. 「プロジェクトを追加」→ プロジェクト名を入力して作成
// 3. 「ウェブアプリを追加」（</> アイコン）→ アプリ名を入力して登録
// 4. 表示された firebaseConfig の値を下にコピー
// 5. Firestore Database → 「データベースの作成」→ 本番環境モード で作成
// 6. 「ルール」タブで以下のルールに変更して「公開」:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;  // 個人利用のため認証なし
//        }
//      }
//    }
// ============================================================
// ※ 設定しない場合はブラウザのローカルストレージに保存されます
//    （スマホ↔PCの同期はされません）
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
