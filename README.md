# 国旗しりとりゲーム

GitHub Pagesで公開できる、スマホ・タブレット・PC対応の「国旗しりとりゲーム」です。`index.html` を開くだけで遊べます。

## 特長

- 選択肢は国旗SVGだけを3つ横並びで表示します。
- 国名・読み仮名は回答前の選択肢には表示しません。
- 1人モードは10問制、ライフ3個です。
- 2〜4人対戦は、同じ端末を順番に回すローカル対戦です。
- 正解・不正解後に国名、首都、短い豆知識を表示します。
- 不正解でライフを1つ失い、ライフ0で脱落します。
- iPhone、iPad、Android、PCのSafari / Chromeを想定し、`100dvh`、safe-area、レスポンシブ表示に対応しています。

## ファイル構成

公開に必要な主なファイルは次のとおりです。

- `index.html`: ゲーム画面とゲーム進行のJavaScript。
- `style.css`: 画面全体、スマートフォン向けレイアウト、国旗カード、回答後表示のスタイル。
- `data/countries.js`: 国データ。各国の `id`、`name`、`reading`、`flagCode`、`flagFile`、`capital`、`region`、`trivia`、`aliases` を管理します。
- `assets/flags/`: 実際の国旗SVG素材。GitHub Pages上で外部通信なしに表示します。

外部ライブラリ、外部API、CDN、サーバー処理は使いません。

## 国旗素材の管理方法

国旗SVGは `assets/flags/` に ISO 3166-1 alpha-2 風の小文字コードで保存します。

例:

```text
assets/flags/sa.svg
assets/flags/ad.svg
assets/flags/jp.svg
```

国データでは `flagCode` と `flagFile` を次のように対応させます。

```js
{
  id: "saudi-arabia",
  name: "サウジアラビア",
  reading: "さうじあらびあ",
  flagCode: "sa",
  flagFile: "assets/flags/sa.svg",
  capital: "リヤド",
  region: "アジア",
  trivia: "アラビア半島にある大きな国です。",
  aliases: []
}
```

運用ルール:

- `flagCode` は空にしないでください。
- `flagFile` は `assets/flags/<flagCode>.svg` にしてください。
- SVG内に国コードや国名を文字として描画しないでください。
- 画面では国コードを代替表示に使わず、国名は `alt` テキストと回答後の学習カードだけに使います。
- 国旗はCSSで `object-fit: contain` 表示し、正方形へ無理に変形しません。
- 追加・変更後は `node tests/country-flags.test.js` を実行し、国旗ファイルと国データの対応を検証してください。

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

## 動作確認

開発時は次の確認を行います。

```bash
node tests/run-all.js
node tests/country-flags.test.js
node --check extracted-script.js
git diff --check
```

実ブラウザで表示後、1人モード、ヒント、国旗選択、正解・不正解表示、対戦モード、結果画面、320px幅での3択横並びを確認してください。
