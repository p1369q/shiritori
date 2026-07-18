# 国旗しりとりゲーム

GitHub Pagesで公開できる、スマホ・タブレット・PC対応の1ファイル完結型「国旗しりとりゲーム」です。`index.html` を開くだけで遊べます。

## 特長

- 選択肢は国旗SVGだけを3つ横並びで表示します。
- 「ヒントを見る」を押した時だけ国名を表示します。
- 1人モードは10問制、ハート3個です。
- 2〜4人対戦は、同じ端末を順番に回すローカル対戦です。
- 不正解でハートを1つ失い、ハート0で脱落します。
- 最後まで残ったプレーヤーが勝ちです。
- プレーヤー名入力、結果画面、もう一度遊ぶボタンがあります。
- iPhone、iPad、Android、PCのSafari / Chromeを想定し、safe-areaとレスポンシブ表示に対応しています。

## ファイル構成

公開に必要なファイルはリポジトリ直下の `index.html` だけです。HTML、CSS、JavaScript、国旗SVGはすべて `index.html` に埋め込んでいます。外部ライブラリ、外部API、CDN、サーバー処理は使いません。

## ローカルで遊ぶ

1. このリポジトリをダウンロードまたはクローンします。
2. `index.html` をブラウザで直接開きます。
3. HTTP配信で確認する場合は次を実行し、`http://127.0.0.1:4173/` を開きます。

```bash
python3 -m http.server 4173
```

## GitHub Pagesでの公開手順

1. GitHubでこのリポジトリを開きます。
2. **Settings** → **Pages** を開きます。
3. **Build and deployment** の Source を **Deploy from a branch** にします。
4. Branch は公開したいブランチ、フォルダーは **/(root)** を選びます。
5. **Save** を押します。
6. 数分後に Pages 画面へ表示されるURLを開きます。

公開URLは通常、次の形式です。

```text
https://<ユーザー名>.github.io/<リポジトリ名>/
```

このリポジトリ名が `shiritori` の場合は、次のようなURLになります。

```text
https://<ユーザー名>.github.io/shiritori/
```

## 動作確認

開発時は次の確認を行います。

```bash
node --check extracted-script.js
git diff --check
python3 -m http.server 4173
```

ブラウザで表示後、1人モード、ヒント表示、国旗選択、対戦モードのプレーヤー名入力、脱落、結果画面、もう一度遊ぶボタンを確認してください。
