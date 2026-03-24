const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const form = document.getElementById("predictForm");
const endpointInput = document.getElementById("endpointInput");
const predictButton = document.getElementById("predictButton");
const resetButton = document.getElementById("resetButton");
const heroPrice = document.getElementById("heroPrice");
const resultBadge = document.getElementById("resultBadge");
const resultPrice = document.getElementById("resultPrice");
const resultRange = document.getElementById("resultRange");
const resultPsf = document.getElementById("resultPsf");
const resultEndpoint = document.getElementById("resultEndpoint");
const resultPayload = document.getElementById("resultPayload");
const resultStatus = document.getElementById("resultStatus");
const messageBox = document.getElementById("messageBox");
const connectionLabel = document.getElementById("connectionLabel");
const predictionMode = document.getElementById("predictionMode");

const processingCanvas = document.getElementById("processingCanvas");
const scenarioCanvas = document.getElementById("scenarioCanvas");
const featureCanvas = document.getElementById("featureCanvas");

const processingCtx = processingCanvas.getContext("2d");
const scenarioCtx = scenarioCanvas.getContext("2d");
const featureCtx = featureCanvas.getContext("2d");
const appConfig = window.BRICK_AI_CONFIG || {};

const datasetBaseline = {
  area: 1409.51,
  total_sqft: 1409.51,
  Bedrooms: 2.71,
  Bathrooms: 2.5,
  Price_sqft: 5543.66,
};

const defaultValues = {
  area: 1350,
  total_sqft: 1350,
  Bedrooms: 3,
  bhk: 3,
  Bathrooms: 3,
  parking: 1,
  Lift: 2,
  Price_sqft: 5047.41,
  latitude: 28.60885,
  longitude: 77.46056,
};

const presets = {
  compact: {
    area: 920,
    total_sqft: 920,
    Bedrooms: 2,
    bhk: 2,
    Bathrooms: 2,
    parking: 1,
    Lift: 1,
    Price_sqft: 4680,
    latitude: 28.566914,
    longitude: 77.436434,
  },
  family: {
    area: 1480,
    total_sqft: 1480,
    Bedrooms: 3,
    bhk: 3,
    Bathrooms: 3,
    parking: 2,
    Lift: 2,
    Price_sqft: 5985,
    latitude: 28.520732,
    longitude: 77.356491,
  },
  luxury: {
    area: 2385,
    total_sqft: 2385,
    Bedrooms: 4,
    bhk: 4,
    Bathrooms: 5,
    parking: 2,
    Lift: 3,
    Price_sqft: 6918.24,
    latitude: 28.645769,
    longitude: 77.38511,
  },
};

const payloadStrategies = [
  {
    name: "Notebook schema",
    build(values) {
      return {
        area: values.area,
        latitude: values.latitude,
        longitude: values.longitude,
        Bedrooms: values.Bedrooms,
        Bathrooms: values.Bathrooms,
        parking: values.parking,
        Lift: values.Lift,
        Price_sqft: values.Price_sqft,
        bhk: values.bhk,
        total_sqft: values.total_sqft,
      };
    },
  },
  {
    name: "Lowercase schema",
    build(values) {
      return {
        area: values.area,
        latitude: values.latitude,
        longitude: values.longitude,
        bedrooms: values.Bedrooms,
        bathrooms: values.Bathrooms,
        parking: values.parking,
        lift: values.Lift,
        price_sqft: values.Price_sqft,
        bhk: values.bhk,
        total_sqft: values.total_sqft,
      };
    },
  },
  {
    name: "Compact schema",
    build(values) {
      return {
        total_sqft: values.total_sqft,
        bath: values.Bathrooms,
        bhk: values.bhk,
        price_per_sqft: values.Price_sqft,
        latitude: values.latitude,
        longitude: values.longitude,
      };
    },
  },
];

let processingAnimationId = null;
let processingFrame = 0;

function getFormValues() {
  const formData = new FormData(form);
  const values = {};

  for (const [key, rawValue] of formData.entries()) {
    values[key] = Number(rawValue);
  }

  return values;
}

function populateForm(values) {
  Object.entries(values).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });

  updateHeroEstimate();
  drawFeatureChart(getFormValues());
}

function validateValues(values) {
  if (!Object.values(values).every((value) => Number.isFinite(value))) {
    throw new Error("Please enter valid numbers in all fields.");
  }

  if (values.area <= 0 || values.total_sqft <= 0 || values.Price_sqft <= 0) {
    throw new Error("Area, total square feet, and price per square foot must be greater than zero.");
  }
}

function getEndpointCandidates() {
  const configuredEndpoint = endpointInput.value.trim() || appConfig.apiUrl || "";
  const currentOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "";
  const fallbackPaths = Array.isArray(appConfig.fallbackPaths) ? appConfig.fallbackPaths : [];

  const candidates = [
    configuredEndpoint,
    ...fallbackPaths.map((path) => (currentOrigin && path.startsWith("/") ? `${currentOrigin}${path}` : path)),
    currentOrigin ? `${currentOrigin}/predict` : "",
    currentOrigin ? `${currentOrigin}/api/predict` : "",
    currentOrigin ? `${currentOrigin}/prediction` : "",
    "/predict",
    "/api/predict",
    "/prediction",
    "http://127.0.0.1:5000/predict",
    "http://localhost:5000/predict",
    "http://127.0.0.1:8000/predict",
    "http://localhost:8000/predict",
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function withTimeout(ms = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.timeoutMs || ms);
  return { controller, timeout };
}

async function tryRequest(endpoint, payloadStrategy, values) {
  const payload = payloadStrategy.build(values);
  const { controller, timeout } = withTimeout();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(
        typeof body === "string" && body.trim()
          ? body.slice(0, 180)
          : `Request failed with status ${response.status}`
      );
    }

    const prediction = extractPrediction(body);

    if (!Number.isFinite(prediction)) {
      throw new Error("Prediction key not found in backend response.");
    }

    return {
      prediction,
      endpoint,
      payloadName: payloadStrategy.name,
      source: "backend",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractPrediction(responseBody) {
  if (typeof responseBody === "number" && Number.isFinite(responseBody)) {
    return responseBody;
  }

  if (typeof responseBody === "string") {
    const parsed = Number(responseBody);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  if (Array.isArray(responseBody)) {
    return extractPrediction(responseBody[0]);
  }

  if (responseBody && typeof responseBody === "object") {
    const keys = [
      "prediction",
      "predicted_price",
      "price",
      "result",
      "estimated_price",
      "predictedPrice",
      "predictedValue",
    ];

    for (const key of keys) {
      if (key in responseBody) {
        const nested = extractPrediction(responseBody[key]);
        if (Number.isFinite(nested)) {
          return nested;
        }
      }
    }

    for (const value of Object.values(responseBody)) {
      const nested = extractPrediction(value);
      if (Number.isFinite(nested)) {
        return nested;
      }
    }
  }

  return NaN;
}

async function requestPrediction(values) {
  const endpoints = getEndpointCandidates();
  const errors = [];

  for (const endpoint of endpoints) {
    for (const strategy of payloadStrategies) {
      try {
        return await tryRequest(endpoint, strategy, values);
      } catch (error) {
        errors.push(`${endpoint} [${strategy.name}]: ${error.message}`);
      }
    }
  }

  return {
    prediction: createPreviewEstimate(values),
    endpoint: "Preview mode",
    payloadName: "Local fallback estimate",
    source: "preview",
    errorMessage: errors[0] || "Backend connection failed.",
  };
}

function createPreviewEstimate(values) {
  const base = values.total_sqft * values.Price_sqft;
  const bedroomBoost = values.Bedrooms * 165000;
  const bathroomBoost = values.Bathrooms * 95000;
  const parkingBoost = values.parking * 70000;
  const liftBoost = values.Lift * 45000;
  const geoBoost = Math.max(0, values.latitude - 28.3) * 500000;
  const geoTrim = Math.max(0, 77.2 - values.longitude) * 350000;

  return Math.max(0, base + bedroomBoost + bathroomBoost + parkingBoost + liftBoost + geoBoost - geoTrim);
}

function drawProcessingIdle() {
  const ctx = processingCtx;
  const { width, height } = processingCanvas;

  ctx.clearRect(0, 0, width, height);
  paintChartBackground(ctx, width, height);
  drawChartTitle(ctx, "System Idle", "Run prediction to activate the signal");

  const points = Array.from({ length: 40 }, (_, index) => {
    const x = 40 + (index * (width - 80)) / 39;
    const y = height * 0.56 + Math.sin(index * 0.42) * 18;
    return [x, y];
  });

  drawLinePath(ctx, points, "#62ecff");
}

function startProcessingAnimation() {
  stopProcessingAnimation();

  const animate = () => {
    processingFrame += 1;
    const ctx = processingCtx;
    const { width, height } = processingCanvas;

    ctx.clearRect(0, 0, width, height);
    paintChartBackground(ctx, width, height);
    drawChartTitle(ctx, "Backend Processing", "Signal stream active while waiting for the prediction API");

    const points = [];
    for (let index = 0; index < 60; index += 1) {
      const x = 36 + (index * (width - 72)) / 59;
      const wave =
        Math.sin(index * 0.38 + processingFrame * 0.12) * 34 +
        Math.sin(index * 0.17 + processingFrame * 0.08) * 12;
      const y = height * 0.54 + wave;
      points.push([x, y]);
    }

    drawLinePath(ctx, points, "#6dffca");

    ctx.fillStyle = "rgba(98, 236, 255, 0.92)";
    const progress = ((processingFrame % 180) / 180) * (width - 120);
    ctx.fillRect(60, height - 42, progress, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(60, height - 42, width - 120, 10);

    processingAnimationId = window.requestAnimationFrame(animate);
  };

  animate();
}

function stopProcessingAnimation() {
  if (processingAnimationId) {
    window.cancelAnimationFrame(processingAnimationId);
    processingAnimationId = null;
  }
}

function drawScenarioChart(prediction) {
  const ctx = scenarioCtx;
  const { width, height } = scenarioCanvas;
  const values = [prediction * 0.94, prediction, prediction * 1.06];
  const labels = ["Conservative", "Predicted", "Premium"];
  const colors = ["#72a7ff", "#62ecff", "#6dffca"];
  const maxValue = Math.max(...values) * 1.15;

  ctx.clearRect(0, 0, width, height);
  paintChartBackground(ctx, width, height);
  drawChartTitle(ctx, "Scenario Projection", "Estimated value bands around the main prediction");

  values.forEach((value, index) => {
    const barWidth = 160;
    const gap = 60;
    const x = 90 + index * (barWidth + gap);
    const chartHeight = 160;
    const barHeight = (value / maxValue) * chartHeight;
    const y = height - 70 - barHeight;

    ctx.fillStyle = colors[index];
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#eef6ff";
    ctx.font = "600 19px Rajdhani";
    ctx.fillText(labels[index], x, height - 32);
    ctx.fillText(shortCurrency(value), x, y - 10);
  });
}

function drawFeatureChart(values) {
  const ctx = featureCtx;
  const { width, height } = featureCanvas;
  const rows = [
    { label: "Area", current: values.area, baseline: datasetBaseline.area },
    { label: "Bedrooms", current: values.Bedrooms, baseline: datasetBaseline.Bedrooms },
    { label: "Bathrooms", current: values.Bathrooms, baseline: datasetBaseline.Bathrooms },
    { label: "Price/Sqft", current: values.Price_sqft ?? values.Price_sqft, baseline: datasetBaseline.Price_sqft },
    { label: "Total Sqft", current: values.total_sqft, baseline: datasetBaseline.total_sqft },
  ];

  ctx.clearRect(0, 0, width, height);
  paintChartBackground(ctx, width, height);
  drawChartTitle(ctx, "Feature Comparison", "Current property values against dataset averages");

  rows.forEach((row, index) => {
    const top = 72 + index * 52;
    const maxValue = Math.max(row.current, row.baseline) || 1;
    const currentWidth = (row.current / maxValue) * 300;
    const baselineWidth = (row.baseline / maxValue) * 300;

    ctx.fillStyle = "#90a7c6";
    ctx.font = "600 18px Rajdhani";
    ctx.fillText(row.label, 50, top + 16);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(180, top, 320, 10);
    ctx.fillStyle = "#72a7ff";
    ctx.fillRect(180, top, baselineWidth, 10);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(540, top, 320, 10);
    ctx.fillStyle = "#62ecff";
    ctx.fillRect(540, top, currentWidth, 10);

    ctx.fillStyle = "#eef6ff";
    ctx.fillText(`Avg ${formatNumber(row.baseline)}`, 180, top - 8);
    ctx.fillText(`Current ${formatNumber(row.current)}`, 540, top - 8);
  });
}

function paintChartBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(10, 20, 35, 0.95)");
  gradient.addColorStop(1, "rgba(7, 12, 22, 0.95)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let y = 48; y < height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(width - 28, y);
    ctx.stroke();
  }
}

function drawChartTitle(ctx, title, subtitle) {
  ctx.fillStyle = "#eef6ff";
  ctx.font = "700 24px Rajdhani";
  ctx.fillText(title, 28, 34);
  ctx.fillStyle = "#90a7c6";
  ctx.font = "500 16px Rajdhani";
  ctx.fillText(subtitle, 28, 56);
}

function drawLinePath(ctx, points, color) {
  if (!points.length) {
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }

  ctx.stroke();
}

function updateHeroEstimate() {
  const values = getFormValues();
  const estimate = createPreviewEstimate(values);
  heroPrice.textContent = formatCurrency(estimate);
}

function updateResultView(result, values) {
  const isPreview = result.source === "preview";
  const lower = result.prediction * 0.94;
  const upper = result.prediction * 1.06;

  resultBadge.textContent = isPreview ? "Preview mode active" : "Prediction complete";
  resultPrice.textContent = formatCurrency(result.prediction);
  resultRange.textContent = `Expected band: ${formatCurrency(lower)} to ${formatCurrency(upper)}`;
  resultPsf.textContent = formatCurrency(result.prediction / values.total_sqft);
  resultEndpoint.textContent = result.endpoint;
  resultPayload.textContent = result.payloadName;
  resultStatus.textContent = isPreview ? "Preview estimate" : "Backend success";
  resultStatus.className = isPreview ? "status-warning" : "status-success";
  messageBox.className = isPreview ? "message-box status-warning" : "message-box status-success";
  messageBox.textContent = isPreview
    ? `Backend response not received. Showing preview estimate. First error: ${result.errorMessage}`
    : "Prediction received successfully.";
  connectionLabel.textContent = isPreview ? "Preview estimate active" : `Connected to ${result.endpoint}`;
  predictionMode.textContent = isPreview ? "Preview Backup" : "Live Backend";

  drawScenarioChart(result.prediction);
  drawFeatureChart(values);
  drawProcessingSuccess(result.prediction, isPreview);
}

function drawProcessingSuccess(prediction, isPreview) {
  stopProcessingAnimation();

  const ctx = processingCtx;
  const { width, height } = processingCanvas;
  ctx.clearRect(0, 0, width, height);
  paintChartBackground(ctx, width, height);
  drawChartTitle(
    ctx,
    isPreview ? "Preview Estimate Ready" : "Backend Prediction Complete",
    isPreview ? "Preview result shown because the API did not respond" : "Prediction completed successfully"
  );

  const points = Array.from({ length: 48 }, (_, index) => {
    const x = 38 + (index * (width - 76)) / 47;
    const base = Math.sin(index * 0.42) * 18;
    const lift = index > 30 ? -((index - 30) * 2.4) : 0;
    return [x, height * 0.62 + base + lift];
  });

  drawLinePath(ctx, points, isPreview ? "#ffd079" : "#62ecff");

  ctx.fillStyle = isPreview ? "#ffd079" : "#6dffca";
  ctx.font = "700 24px Rajdhani";
  ctx.fillText(`Final Price: ${shortCurrency(prediction)}`, 42, height - 40);
}

function setLoadingState(isLoading) {
  form.classList.toggle("is-loading", isLoading);
  predictButton.disabled = isLoading;
  predictButton.querySelector("span").textContent = isLoading ? "Processing..." : "Predict House Price";

  if (isLoading) {
    resultBadge.textContent = "Calling backend";
    resultStatus.textContent = "Connecting...";
    startProcessingAnimation();
  }
}

function resetDashboard() {
  stopProcessingAnimation();
  resultBadge.textContent = "Waiting for prediction";
  resultPrice.textContent = "Rs --";
  resultRange.textContent = "Run a prediction to view the estimated price range.";
  resultPsf.textContent = "Rs --";
  resultEndpoint.textContent = "Not connected";
  resultPayload.textContent = "Waiting";
  resultStatus.textContent = "Ready";
  resultStatus.className = "";
  messageBox.textContent =
    "Start the backend and run a prediction to view the result here.";
  messageBox.className = "message-box";
  connectionLabel.textContent = "Backend connection ready";
  predictionMode.textContent = "Backend First";

  drawProcessingIdle();
  drawScenarioChart(createPreviewEstimate(getFormValues()));
  drawFeatureChart(getFormValues());
}

function formatCurrency(value) {
  return `Rs ${currencyFormatter.format(value)}`;
}

function shortCurrency(value) {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(2)} Cr`;
  }

  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)} L`;
  }

  return Math.round(value).toString();
}

function formatNumber(value) {
  return Number(value).toFixed(value > 10 ? 0 : 2);
}

form.addEventListener("input", () => {
  updateHeroEstimate();
  drawFeatureChart(getFormValues());
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const values = getFormValues();
    validateValues(values);
    setLoadingState(true);

    const result = await requestPrediction(values);
    updateResultView(result, values);
  } catch (error) {
    stopProcessingAnimation();
    resultBadge.textContent = "Prediction failed";
    resultStatus.textContent = "Error";
    resultStatus.className = "status-error";
    messageBox.textContent = error.message;
    messageBox.className = "message-box status-error";
    connectionLabel.textContent = "Check backend route or field values";
    drawProcessingIdle();
  } finally {
    setLoadingState(false);
  }
});

resetButton.addEventListener("click", () => {
  populateForm(defaultValues);
  resetDashboard();
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    populateForm(presets[button.dataset.preset]);
    resetDashboard();
  });
});

document.querySelectorAll(".tilt-card").forEach((card) => {
  card.addEventListener("mousemove", (event) => {
    const rect = card.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateY = offsetX * 7;
    const rotateX = offsetY * -7;
    card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
  });
});

populateForm(defaultValues);
drawProcessingIdle();
drawScenarioChart(createPreviewEstimate(defaultValues));
drawFeatureChart(defaultValues);
if (appConfig.apiUrl) {
  endpointInput.value = appConfig.apiUrl;
}
