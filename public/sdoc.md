---
file: sdoc.md
title: Miyagi Reports
tags:
  - report-hub
  - pmo
---

# Miyagi Reports

This hub renders PMO operational reports produced by the Miyagi Sanchez routines. It is the review surface for report packets before and after they are routed to Telegram.

Use it for:

- Daily standup story decks.
- Weekly PMO recaps.
- Monthly operational packets.
- Report source that mixes prose, charts, diagrams, slides, and cells.

## How report links work

Most packets travel as `/docs#md=...` links. The report content sits in the URL fragment, which browsers do not send to the server when the page loads. The server serves the viewer assets; the browser renders the packet.

When a short link is generated, the server stores encrypted ciphertext. The decryption key stays in the URL the reviewer receives. Use short links for Telegram delivery and mobile review, not as a long-term archive.

## Report packet checklist

- Title names the routine and reporting window.
- Executive summary fits on a phone screen.
- Links are short enough for Telegram previews.
- Slides use landscape, story-friendly framing.
- Any cells block has the values a reviewer needs to inspect.
- The packet says what needs attention, what changed, and what is next.

## Built on SmallDocs

Miyagi Reports is our branded fork of SmallDocs. The underlying renderer keeps the SmallDocs mechanics: Markdown input, browser-side rendering, export to PDF or PowerPoint for slides, and optional encrypted short links.

Open `/trust` to verify the served assets against the published manifest. Open `/legal` for license and terms.
