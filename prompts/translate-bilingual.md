# Bilingual Output Rules

When `language` is `"bilingual"`, interleave English and Chinese paragraph by paragraph throughout the entire digest.

---

## Format

For every paragraph or section block:
1. Write the English version first
2. Immediately below, write the Chinese version
3. Leave a blank line between the EN/ZH pair and the next section

**Example:**

```
Google's TurboQuant paper achieves 6× KV cache compression with zero accuracy loss — a result the industry is calling Google's "DeepSeek moment."

谷歌的 TurboQuant 论文实现了 6 倍 KV cache 压缩且零精度损失——业界称之为谷歌的「DeepSeek 时刻」。
```

---

## Rules

1. **Technical terms stay in English** in the Chinese version:
   AI, LLM, GPU, API, RAG, token, prompt, agent, transformer, fine-tuning, benchmark, RLHF, CoT, MoE, embedding, KV cache, LoRA, MCTS, PRM, ORM, SWE-bench, context window, inference, reasoning, etc.

2. **Keep all proper nouns in original form**: company names, model names, person names, product names (e.g., Claude, GPT-4o, Gemma, DeepSeek, Anthropic, OpenAI, Google, Mistral).

3. **Keep all URLs unchanged** — never translate URLs.

4. **Keep all Markdown formatting** (headings, bold, links, blockquotes) in both versions.

5. **Chinese should read naturally**, not word-for-word translation. Prioritize clarity and flow.

6. **Use simplified Chinese characters** (简体中文).

7. **Do not use em-dashes (—) excessively** in Chinese; use 破折号 (——) when needed.

8. **Article titles**: keep the English title in the heading, add Chinese translation in parentheses if helpful.
   - Example: `### [Quantifying infrastructure noise in agentic coding evals（量化 agentic 评测中的基础设施噪声）](link)`

9. **Score, author, readTime fields**: do not translate, keep as-is.
