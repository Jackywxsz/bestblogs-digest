# bestblogs-daily

**每日 AI 精选日报 · 中英双语 · OpenClaw Skill**

A daily bilingual AI digest from [BestBlogs.dev](https://www.bestblogs.dev), delivered as an OpenClaw skill.

---

## 这是什么 / What Is This

`bestblogs-daily` 每天从 BestBlogs.dev 抓取 AI 评分 ≥ 90 分的高质量 AI 文章，按主题聚类，加上编辑点评，生成双语（中英）日报。

`bestblogs-daily` fetches the highest-quality AI articles (score ≥ 90) from BestBlogs.dev daily, groups them into thematic clusters with editorial commentary, and delivers a bilingual (English + Chinese) digest.

**BestBlogs.dev** 已用 AI 对每篇文章做了摘要和评分 — 本 skill 的工作是进一步策展，而非重新摘要。

BestBlogs.dev already summarizes and scores every article with AI — this skill curates, not re-summarizes.

---

## 安装 / Installation

### OpenClaw

```bash
clawhub install bestblogs-daily
```

或手动克隆：

```bash
git clone https://github.com/qujingde/bestblogs-daily ~/skills/bestblogs-daily
cd ~/skills/bestblogs-daily/scripts && npm install
```

---

## 使用 / Usage

| 命令 | 功能 |
|------|------|
| `/bestblogs` | 立即生成并推送今日日报 |
| `/bestblogs setup` | 重新运行配置向导 |
| `/bestblogs config` | 查看当前配置 |

首次运行会自动进入配置向导（选择语言、推送频率、时间等），完成后立即推送第一份日报。

On first run, an onboarding wizard guides you through setup (language, frequency, time). A welcome digest is delivered immediately after.

---

## 日报示例 / Sample Digest

见 [examples/sample-digest.md](examples/sample-digest.md)

---

## 配置项 / Configuration

配置文件位置：`~/.bestblogs-daily/config.json`

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `language` | `"bilingual"` | `"bilingual"` 中英对照 / `"zh"` 仅中文 / `"en"` 仅英文 |
| `frequency` | `"daily"` | `"daily"` 每天 / `"weekly"` 每周 |
| `deliveryTime` | `"08:00"` | 本地时间，HH:MM 格式 |
| `timezone` | `"Asia/Shanghai"` | IANA 时区 |
| `maxArticles` | `15` | 每期最多文章数（5–30）|

---

## 自定义 Prompt / Custom Prompts

将 `prompts/` 目录复制到 `~/.bestblogs-daily/prompts/` 并修改即可覆盖默认 prompt：

```bash
cp -r ~/skills/bestblogs-daily/prompts ~/.bestblogs-daily/prompts
```

---

## 数据来源 / Data Source

- 内容来源：[BestBlogs.dev](https://www.bestblogs.dev)（[ginobefun/bestblogs](https://github.com/ginobefun/bestblogs)）
- RSS 端点：`https://www.bestblogs.dev/en/feeds/rss?category=ai&minScore=90`
- 评分说明：BestBlogs 用 GPT-4o 对每篇文章打分（0–100），本 skill 只取 90 分以上的内容

---

## 技术架构 / Architecture

```
OpenClaw cron
     ↓
SKILL.md (skill brain)
     ↓
node scripts/fetch-rss.js --lang both
     ↓ (parallel fetch EN + ZH RSS, merge by GUID)
node scripts/prepare-digest.js
     ↓ (dedup, time-filter, sort by score, load prompts)
LLM (Claude) generates editorial digest
     ↓ (thematic clustering + bilingual interleaving)
OpenClaw delivers to channel
     ↓
Update ~/.bestblogs-daily/state.json (dedup state)
```

与 [follow-builders](https://github.com/zarazhangrui/follow-builders) 相比，无需 GitHub Actions 服务端管线 — BestBlogs RSS 本身就是公开的稳定数据源，每小时更新。

---

## 致谢 / Credits

- [BestBlogs.dev](https://www.bestblogs.dev) — 内容聚合与 AI 评分
- [zarazhangrui/follow-builders](https://github.com/zarazhangrui/follow-builders) — skill 架构参考
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — XML 解析

---

## License

MIT © [qujingde](https://github.com/qujingde)
