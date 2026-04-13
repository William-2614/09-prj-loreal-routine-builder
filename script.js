/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");

/* Use a Set so add/remove/check operations stay simple */
const selectedProducts = new Set();
let allProducts = [];
let hasGeneratedRoutine = false;
let selectedCategory = "";
let searchKeyword = "";

/* Store full conversation history for follow-up responses */
const conversationHistory = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return data.products;
}

/* Apply both category and keyword filters at the same time */
function applyProductFilters() {
  if (allProducts.length === 0) {
    return;
  }

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      selectedCategory === "" || product.category === selectedCategory;

    const searchableText =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    const matchesSearch =
      searchKeyword === "" || searchableText.includes(searchKeyword);

    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your current filters.
      </div>
    `;
    return;
  }

  displayProducts(filteredProducts);
}

/* Load products once at startup */
async function initializeProductGrid() {
  try {
    await loadProducts();
    applyProductFilters();
  } catch (error) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Unable to load products right now.
      </div>
    `;
  }
}

/* Add one message bubble to the chat window */
function addChatMessage(role, content) {
  const message = document.createElement("p");
  message.className =
    role === "user" ? "chat-user-message" : "chat-assistant-message";
  message.textContent = content;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Reset chat UI and history for a new routine conversation */
function startNewConversation(selectedProductData, routineText) {
  chatWindow.innerHTML = "";

  const systemMessage = {
    role: "system",
    content:
      "You are a beauty advisor chatbot. You may only answer questions about the generated routine or related topics: skincare, haircare, makeup, fragrance, grooming, and product usage. If the user asks unrelated topics, politely refuse and guide them back to beauty and routine questions.",
  };

  const contextMessage = {
    role: "user",
    content: `These are the selected products for this routine:\n\n${JSON.stringify(selectedProductData, null, 2)}`,
  };

  const routineMessage = {
    role: "assistant",
    content: routineText,
  };

  conversationHistory.length = 0;
  conversationHistory.push(systemMessage, contextMessage, routineMessage);

  addChatMessage("assistant", routineText);
  hasGeneratedRoutine = true;
}

/* Keep client-side guardrails for clearly unrelated questions */
function isBeautyRelatedQuestion(question) {
  const normalizedQuestion = question.toLowerCase();
  const allowedKeywords = [
    "routine",
    "skin",
    "skincare",
    "face",
    "hair",
    "haircare",
    "makeup",
    "fragrance",
    "perfume",
    "cleanser",
    "moisturizer",
    "serum",
    "sunscreen",
    "spf",
    "conditioner",
    "shampoo",
    "foundation",
    "mascara",
    "lip",
    "beauty",
    "grooming",
    "product",
    "morning",
    "evening",
    "am",
    "pm",
  ];

  return allowedKeywords.some((keyword) =>
    normalizedQuestion.includes(keyword),
  );
}

/* Shared OpenAI call helper */
async function getOpenAIReply(messages) {
  const workerApiUrl = (window.WORKER_API_URL || "").trim();

  if (workerApiUrl) {
    return getOpenAIReplyFromWorker(workerApiUrl, messages);
  }

  const apiKey = (window.OPENAI_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error(
      "No API config found. For local testing, add OPENAI_API_KEY in secrets.js. For deployed sites, set WORKER_API_URL in config.js.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const reply = data.choices[0].message.content;

  if (!reply) {
    throw new Error("OpenAI returned an empty response.");
  }

  return reply;
}

/* Secure mode: call your Cloudflare Worker instead of exposing a browser API key */
async function getOpenAIReplyFromWorker(workerApiUrl, messages) {
  const normalizedWorkerApiUrl = workerApiUrl.startsWith("http")
    ? workerApiUrl
    : `https://${workerApiUrl}`;

  const response = await fetch(normalizedWorkerApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(
      `Worker request failed with status ${response.status}. Check Worker URL and deployment.`,
    );
  }

  const data = await response.json();
  const reply = data.reply;

  if (!reply) {
    throw new Error("Worker returned an empty response.");
  }

  return reply;
}

/* Find full product objects for products currently selected by the user */
async function getSelectedProductData() {
  if (allProducts.length === 0) {
    await loadProducts();
  }

  return allProducts
    .filter((product) => selectedProducts.has(product.name))
    .map((product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));
}

/* Call OpenAI and ask for a routine using only the selected products */
async function generatePersonalizedRoutine(selectedProductData) {
  return getOpenAIReply([
    {
      role: "system",
      content:
        "You are a skincare and beauty routine assistant. Build a clear daily routine using ONLY the products provided by the user.",
    },
    {
      role: "user",
      content: `Create a simple morning and evening routine using only these selected products:\n\n${JSON.stringify(selectedProductData, null, 2)}`,
    },
  ]);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${selectedProducts.has(product.name) ? "is-selected" : ""}" data-product-name="${product.name}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button type="button" class="description-toggle" aria-expanded="false" aria-controls="product-description-${product.id}">
          View details
        </button>
        <p id="product-description-${product.id}" class="product-description" hidden>
          ${product.description}
        </p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Render selected product names as pills in the selected products box */
function renderSelectedProducts() {
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML = `<p class="selected-placeholder">No products selected yet.</p>`;
    return;
  }

  selectedProductsList.innerHTML = [...selectedProducts]
    .map((productName) => `<span>${productName}</span>`)
    .join("");
}

/* Toggle selected state when a card is clicked */
productsContainer.addEventListener("click", (e) => {
  const toggleButton = e.target.closest(".description-toggle");

  if (toggleButton) {
    const descriptionId = toggleButton.getAttribute("aria-controls");
    const description = document.getElementById(descriptionId);
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";

    toggleButton.setAttribute("aria-expanded", String(!isExpanded));
    toggleButton.textContent = isExpanded ? "View details" : "Hide details";
    description.hidden = isExpanded;
    return;
  }

  const card = e.target.closest(".product-card");

  if (!card) {
    return;
  }

  const productName = card.dataset.productName;

  if (selectedProducts.has(productName)) {
    selectedProducts.delete(productName);
  } else {
    selectedProducts.add(productName);
  }

  card.classList.toggle("is-selected");
  renderSelectedProducts();
});

/* Update category filter */
categoryFilter.addEventListener("change", (e) => {
  selectedCategory = e.target.value;
  applyProductFilters();
});

/* Live search while typing */
productSearch.addEventListener("input", (e) => {
  searchKeyword = e.target.value.trim().toLowerCase();
  applyProductFilters();
});

/* Show initial message in selected products area */
renderSelectedProducts();

/* Build the initial product grid */
initializeProductGrid();

/* Generate routine from selected products when button is clicked */
generateRoutineButton.addEventListener("click", async () => {
  const selectedProductData = await getSelectedProductData();

  if (selectedProductData.length === 0) {
    chatWindow.textContent =
      "Please select at least one product before generating a routine.";
    return;
  }

  chatWindow.textContent = "Generating your personalized routine...";
  generateRoutineButton.disabled = true;

  try {
    const routine = await generatePersonalizedRoutine(selectedProductData);
    startNewConversation(selectedProductData, routine);
  } catch (error) {
    chatWindow.textContent = `Unable to generate routine: ${error.message}`;
  } finally {
    generateRoutineButton.disabled = false;
  }
});

/* Handle follow-up questions using full chat history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();

  if (!hasGeneratedRoutine) {
    addChatMessage(
      "assistant",
      "Generate a routine first, then I can answer follow-up questions about it.",
    );
    return;
  }

  if (!question) {
    return;
  }

  if (!isBeautyRelatedQuestion(question)) {
    addChatMessage(
      "assistant",
      "I can only answer questions about your routine or beauty topics like skincare, haircare, makeup, fragrance, and grooming.",
    );
    userInput.value = "";
    return;
  }

  addChatMessage("user", question);
  userInput.value = "";
  sendButton.disabled = true;

  conversationHistory.push({
    role: "user",
    content: question,
  });

  try {
    const assistantReply = await getOpenAIReply(conversationHistory);

    conversationHistory.push({
      role: "assistant",
      content: assistantReply,
    });

    addChatMessage("assistant", assistantReply);
  } catch (error) {
    addChatMessage("assistant", `Unable to answer follow-up: ${error.message}`);
  } finally {
    sendButton.disabled = false;
  }
});
