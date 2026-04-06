# 買い物リスト アプリ

Amazon・西友ネットスーパー連携の個人用買い物リストアプリです。

## 機能

- 品目と個数の管理（タップで増減、直接入力も可）
- ドラッグ＆ドロップ（PC）/ ↑↓ボタン（スマホ）で並び替え
- **Amazon**: まとめてカートに追加（1タップ）
- **西友**: PCのChrome拡張で自動カート追加（1タップ）
- スマホ ↔ PC リアルタイム同期（Firebase使用）
- PWA対応（iPhoneのホーム画面に追加して使用可能）

---

## セットアップ手順

### 1. Firebaseの設定（スマホ↔PC同期に必要）

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」→ 任意のプロジェクト名で作成
3. 「ウェブアプリを追加」（`</>` アイコン）→ アプリ名を入力して登録
4. 表示された `firebaseConfig` の値を `firebase-config.js` にコピー
5. 左メニュー「Firestore Database」→「データベースの作成」→「本番環境モード」
6. 「ルール」タブを開いて以下に変更し「公開」:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

> Firebaseを設定しない場合は、ブラウザのローカルストレージに保存されます（同期なし）

---

### 2. GitHub Pagesへのデプロイ（推奨）

1. このリポジトリの Settings → Pages
2. Source: `main` ブランチ、`/ (root)` を選択して保存
3. 表示されたURL（例: `https://username.github.io/ShoppingAP/`）にアクセス

---

### 3. iPhoneでホーム画面に追加

1. Safariでアプリのページを開く
2. 共有ボタン（□↑）→「ホーム画面に追加」
3. ホーム画面から起動できるようになります

---

### 4. Chrome拡張機能のインストール（PC・西友自動カート追加）

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension/` フォルダを選択

インストール後は、アプリの「西友 まとめてカート追加」ボタンを押すと自動でカートに入ります。

---

## 使い方

### 在庫確認（主にスマホ）

1. アプリを開く
2. 在庫が少ない品目の「＋」ボタンで個数を入力
3. 個数 > 0 の品目がハイライトされる

### 買い物（主にPC）

1. 画面下の「amazon まとめてカート追加」→ Amazonカートに全品目を一括追加
2. 「西友 まとめてカート追加」→ 各商品ページが順に開いてChrome拡張が自動クリック

### 品目の設定（初回のみ）

1. 右上の「✏️」ボタンで編集モードに入る
2. 各品目の「⚙️」ボタンで編集
3. Amazon ASINと西友商品IDを入力して保存

#### Amazon ASINの調べ方
商品ページURLの `/dp/XXXXXXXXXX/` の部分（10文字）

例: `https://www.amazon.co.jp/dp/B07XXXXXXXXX/` → ASIN: `B07XXXXXXXXX`

#### 西友商品IDの調べ方
商品ページURLの `/item/XXXXX/` の部分

例: `https://netsuper.rakuten.co.jp/seiyu/item/4902720165457/` → ID: `4902720165457`

---

## ファイル構成

```
ShoppingAP/
├── index.html          # メインページ
├── style.css           # スタイル
├── app.js              # アプリロジック
├── firebase-config.js  # Firebase設定（要編集）
├── manifest.json       # PWAマニフェスト
├── sw.js               # Service Worker
├── icons/              # アイコン画像
└── chrome-extension/   # Chrome拡張機能
    ├── manifest.json
    └── content.js      # 西友自動カート追加スクリプト
```
