# The Swing Checker

## プロジェクト概要
ゴルフスイングを録画・再生・分析するモバイルWebアプリケーション

## 技術スタック
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- MediaRecorder API (録画)
- getUserMedia API (カメラ)

## よく使うコマンド
- `npm run dev` - 開発サーバー起動 (http://localhost:3000)
- `npm run build` - 本番ビルド
- `npm run lint` - ESLintでコードチェック

## 主な機能
- 10秒録画（デフォルト、設定で変更可能）
- イン/アウトカメラ切り替え
- スロー再生（0.25x, 0.5x, 1x）
- コマ送り再生
- 動画ダウンロード
- 初回利用ガイド

## UIルール
- 絵文字は使用しない（アイコンやテキストで表現する）
- シンプルでミニマルなデザイン
- ダークテーマベース

## Claudeの応答スタイル
- ask_user_input スタイルで返答する
- ユーザーに質問や選択肢を提示する形式を優先
- 一方的に進めず、確認を取りながら作業する
