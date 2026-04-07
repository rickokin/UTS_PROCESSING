# Documentation — Lived Experience Insights Engine

## Table of Contents

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System overview, component diagram, tech stack |
| [Pipeline](./pipeline.md) | Deep dive into Phase 1 and Phase 2 processing stages |
| [API Reference](./api-reference.md) | Every `/api/*` endpoint — request/response formats, streaming protocols |
| [Data Formats](./data-formats.md) | JSON artifact schemas, file naming conventions, vocabulary enums |
| [Locks Pack](./locks-pack.md) | How schemas, vocab, rules, and prompts constrain LLM output |
| [Rules & Prompts](./rules-and-prompts.md) | How rule files and prompt cards are composed per phase of the Insights Report process |
| [Development](./development.md) | Local setup, project structure, coding conventions, offline validation |
| [Deployment](./deployment.md) | Environment requirements, hosting constraints, production checklist |

## Quick Start

```bash
git clone <repository-url>
cd UTS_PROCESSING
npm install

# Create .env.local with your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

npm run dev
# Open http://localhost:3000
```

## Project at a Glance

The Lived Experience Insights Engine transforms qualitative interview transcripts (`.docx`) into structured, schema-validated insights and publication-ready reports. It is built for the UTS research initiative: *Documenting and amplifying women's lived experiences.*

**Core pipeline:**

```
.docx transcripts → Moments → Clusters → Insights → Report (JSON / DOCX / PDF)
```

Every LLM call is constrained by the **Locks Pack** — a versioned bundle of JSON Schemas, closed vocabularies, YAML rules, and prompt cards that prevent hallucination of categories or structure.
