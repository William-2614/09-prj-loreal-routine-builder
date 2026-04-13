# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Live Deploy Setup (Secure)

If your deployed site says API key is missing, use this secure setup.

### 1) Deploy the Cloudflare Worker

1. Create a free Cloudflare account.
2. Go to Workers & Pages.
3. Create a new Worker.
4. Replace the Worker code with the contents of [cloudflare-worker.js](cloudflare-worker.js).
5. In Worker Settings > Variables and Secrets, add a secret:
   - Name: OPENAI_API_KEY
   - Value: your real OpenAI key
6. Deploy the Worker.
7. Copy your Worker URL (example: https://your-name.your-subdomain.workers.dev).

### 2) Connect your frontend to the Worker

1. Open [config.js](config.js).
2. Paste your Worker URL:

```js
window.WORKER_API_URL = "https://your-name.your-subdomain.workers.dev";
```

3. Commit and push [config.js](config.js) and [index.html](index.html) changes.
4. Redeploy your site.

### 3) Local testing option

For local-only testing, you can still use [secrets.js](secrets.js) with:

```js
window.OPENAI_API_KEY = "your-key-here";
```

Do not commit [secrets.js](secrets.js). It is already in [.gitignore](.gitignore).
