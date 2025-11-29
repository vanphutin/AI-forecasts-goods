let rawData = [];
let chart = null;
let analyticsChart = null;
let compareChart = null;
let multiChart = null;
let multiYearData = {};

// ---------------- TAB SWITCH ----------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.onclick = () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tabId = btn.getAttribute("data-tab");

    document
      .querySelectorAll(".tab")
      .forEach((tab) => tab.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
  };
});

// ---------------- LOADING ----------------
function showLoading() {
  document.getElementById("loading").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loading").classList.add("hidden");
}

// ---------------- NOTIFY ----------------
function notifyError(msg) {
  alert(msg || "Có lỗi xảy ra. Vui lòng thử lại.");
}

// ---------------- UPLOAD ----------------
async function uploadFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Hãy chọn file CSV!");

  const form = new FormData();
  form.append("file", file);

  try {
    showLoading();
    const res = await fetch("http://localhost:8000/api/upload", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Upload thất bại: ${res.status}`);
    }

    const data = await res.json();
    rawData = data.raw_data || [];

    document.getElementById("uploadPreview").textContent = JSON.stringify(
      data.data_preview,
      null,
      2
    );
    document.getElementById("uploadPreview").classList.remove("empty");

    const skuSet = [...new Set(rawData.map((r) => r.sku))];

    const optionsHtml = skuSet.length
      ? skuSet.map((sku) => `<option value="${sku}">${sku}</option>`).join("")
      : `<option value="">-- Không có SKU --</option>`;

    document.getElementById("skuSelect").innerHTML = optionsHtml;
    document.getElementById("compareSku1").innerHTML = optionsHtml;
    document.getElementById("compareSku2").innerHTML = optionsHtml;
  } catch (err) {
    console.error(err);
    notifyError(err.message);
  } finally {
    hideLoading();
  }
}

// ---------------- FORECAST ----------------
async function forecast() {
  const sku = document.getElementById("skuSelect").value;
  const daysInput = document.getElementById("daysInput");
  const days = parseInt(daysInput.value, 10);

  if (!rawData.length) {
    return alert("Chưa có dữ liệu. Hãy upload file CSV trước.");
  }

  if (!sku) {
    return alert("Hãy chọn SKU để dự báo.");
  }

  if (isNaN(days) || days < 7 || days > 30) {
    return alert("Số ngày dự báo nên nằm trong khoảng 7–30.");
  }

  const payload = {
    sku: sku,
    data: rawData.filter((r) => r.sku === sku),
    days: days,
  };

  try {
    showLoading();
    const res = await fetch("http://localhost:8000/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Lỗi forecast: ${res.status}`);
    }

    const data = await res.json();

    document.getElementById("forecastSummary").textContent =
      data.summary || "Không có summary trả về.";

    renderForecastChart(payload.data, data);
  } catch (err) {
    console.error(err);
    notifyError(err.message);
  } finally {
    hideLoading();
  }
}

function renderForecastChart(history, ai) {
  const labels = [
    ...history.map((h) => h.date),
    ...(ai.forecast || []).map((f) => f.date),
  ];

  const actual = history.map((h) => h.quantity);
  const forecastValues = [
    ...Array(history.length).fill(null),
    ...(ai.forecast || []).map((f) => f.forecast_qty),
  ];

  if (chart) chart.destroy();

  const ctx = document.getElementById("forecastChart");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Actual",
          data: actual,
          borderColor: "#22c55e",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: "Forecast",
          data: forecastValues,
          borderColor: "#eab308",
          borderWidth: 2,
          borderDash: [6, 6],
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            color: "#9ca3af",
            maxRotation: 45,
            minRotation: 0,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.15)",
          },
        },
        y: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb",
          },
        },
      },
    },
  });
}

// ---------------- ANALYTICS ----------------

// Hàm hiển thị AI phân tích
function renderAIAnalytics(data) {
  const el = document.getElementById("analysisText");

  const summary = data.summary || data.ai_analysis?.overall_summary || "";
  const strong = data.ai_analysis?.strong_skus || [];
  const weak = data.ai_analysis?.weak_skus || [];
  const insights = data.ai_analysis?.key_insights || [];

  // Hàm format item (string hoặc object)
  const formatSku = (item) => {
    if (typeof item === "string") {
      return `<li style="margin:4px 0; color:#bbf7d0;">${item}</li>`;
    }
    if (typeof item === "object") {
      return `
        <li style="margin:6px 0; color:#bbf7d0;">
          <strong>${item.sku}</strong> — ${item.quantity ?? ""} 
          ${
            item.reason
              ? `<div style="color:#9ae6b4; font-size:12px; margin-left:10px;">${item.reason}</div>`
              : ""
          }
        </li>
      `;
    }
    return "";
  };

  const formatWeakSku = (item) => {
    if (typeof item === "string") {
      return `<li style="margin:4px 0; color:#fecaca;">${item}</li>`;
    }
    if (typeof item === "object") {
      return `
        <li style="margin:6px 0; color:#fecaca;">
          <strong>${item.sku}</strong> — ${item.quantity ?? ""}
          ${
            item.reason
              ? `<div style="color:#fca5a5; font-size:12px; margin-left:10px;">${item.reason}</div>`
              : ""
          }
        </li>
      `;
    }
    return "";
  };

  el.innerHTML = `
    <div style="font-size:14px; line-height:1.5;">

      <h3 style="color:#38bdf8; font-size:15px;">📌 Tổng quan</h3>
      <p style="color:#e5e7eb; margin-bottom:10px;">
        ${summary}
      </p>

      <h3 style="color:#22c55e; font-size:15px;">🟢 SKU mạnh</h3>
      <ul style="margin-left:18px; margin-bottom:10px;">
        ${strong.map(formatSku).join("")}
      </ul>

      <h3 style="color:#f87171; font-size:15px;">🔴 SKU yếu</h3>
      <ul style="margin-left:18px; margin-bottom:10px;">
        ${weak.map(formatWeakSku).join("")}
      </ul>

      <h3 style="color:#facc15; font-size:15px;">💡 Insight quan trọng</h3>
      <ul style="margin-left:18px;">
        ${insights
          .map((t) => `<li style="margin:4px 0; color:#fde68a;">${t}</li>`)
          .join("")}
      </ul>

    </div>
  `;
}

// Hàm gọi API để phân tích
async function analyzeData() {
  if (!rawData.length) {
    return alert("Chưa có dữ liệu. Hãy upload CSV trước.");
  }

  try {
    showLoading();

    const res = await fetch("http://localhost:8000/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: rawData }),
    });

    if (!res.ok) {
      throw new Error(`Lỗi phân tích AI: ${res.status}`);
    }

    const data = await res.json();

    // 👉 HIỂN THỊ PHÂN TÍCH AI
    renderAIAnalytics(data);

    // 👉 VẼ BIỂU ĐỒ SKU
    renderAnalyticsChart();
  } catch (err) {
    console.error(err);
    notifyError(err.message);
  } finally {
    hideLoading();
  }
}

// Biểu đồ tổng lượng bán theo SKU
function renderAnalyticsChart() {
  const bySku = {};

  rawData.forEach((row) => {
    if (!bySku[row.sku]) bySku[row.sku] = 0;
    bySku[row.sku] += Number(row.quantity) || 0;
  });

  const labels = Object.keys(bySku);
  const values = Object.values(bySku);

  if (analyticsChart) analyticsChart.destroy();

  const ctx = document.getElementById("analyticsChart");

  analyticsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tổng lượng bán theo SKU",
          data: values,
          backgroundColor: "#0ea5e9",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            display: false,
          },
        },
        y: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb",
          },
        },
      },
    },
  });
}

// ---------------- COMPARE ----------------
async function compareForecast() {
  const sku1 = document.getElementById("compareSku1").value;
  const sku2 = document.getElementById("compareSku2").value;

  if (!rawData.length) {
    return alert("Chưa có dữ liệu. Hãy upload CSV trước.");
  }

  if (!sku1 || !sku2) {
    return alert("Hãy chọn đủ 2 SKU để so sánh.");
  }

  if (sku1 === sku2) {
    return alert("Vui lòng chọn 2 SKU khác nhau.");
  }

  const getForecast = async (sku) => {
    const res = await fetch("http://localhost:8000/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        data: rawData.filter((r) => r.sku === sku),
        days: 14,
      }),
    });

    if (!res.ok) {
      throw new Error(`Lỗi forecast cho SKU ${sku}: ${res.status}`);
    }
    return await res.json();
  };

  try {
    showLoading();

    const [f1, f2] = await Promise.all([getForecast(sku1), getForecast(sku2)]);

    const labels = (f1.forecast || []).map((f) => f.date);
    const values1 = (f1.forecast || []).map((f) => f.forecast_qty);
    const values2 = (f2.forecast || []).map((f) => f.forecast_qty);

    if (compareChart) compareChart.destroy();

    const ctx = document.getElementById("compareChart");

    compareChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `SKU ${sku1}`,
            data: values1,
            borderColor: "#22c55e",
            borderWidth: 2,
            tension: 0.25,
          },
          {
            label: `SKU ${sku2}`,
            data: values2,
            borderColor: "#eab308",
            borderWidth: 2,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            ticks: {
              color: "#9ca3af",
            },
            grid: {
              color: "rgba(148, 163, 184, 0.15)",
            },
          },
          y: {
            ticks: {
              color: "#9ca3af",
            },
            grid: {
              color: "rgba(148, 163, 184, 0.18)",
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
            },
          },
        },
      },
    });
  } catch (err) {
    console.error(err);
    notifyError(err.message);
  } finally {
    hideLoading();
  }
}

// ---------------- EXPORT PDF ----------------
async function exportPDF() {
  if (!chart) {
    alert("Hãy dự báo trước rồi mới xuất PDF!");
    return;
  }

  const sku = document.getElementById("skuSelect").value || "UNKNOWN";

  try {
    showLoading();

    const chartCanvas = document.getElementById("forecastChart");
    const chartImage = await html2canvas(chartCanvas).then((canvas) =>
      canvas.toDataURL("image/png")
    );

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    pdf.setFontSize(18);
    pdf.text("📊 Báo cáo Dự báo bán hàng (AI Forecast)", 10, 20);

    pdf.setFontSize(11);
    pdf.text(`Thời gian xuất: ${new Date().toLocaleString()}`, 10, 30);
    pdf.text(`SKU được dự báo: ${sku}`, 10, 38);

    const summary =
      document.getElementById("forecastSummary").innerText ||
      "Không có summary.";
    pdf.setFontSize(12);
    pdf.text("📌 Summary:", 10, 50);

    const splitSummary = pdf.splitTextToSize(summary, 180);
    pdf.setFontSize(11);
    pdf.text(splitSummary, 10, 58);

    pdf.addImage(chartImage, "PNG", 10, 105, 190, 90);

    pdf.save(`forecast_${sku}.pdf`);
  } catch (err) {
    console.error(err);
    notifyError(err.message);
  } finally {
    hideLoading();
  }
}

// ---------------- MULTI-YEAR UPLOAD ----------------
async function uploadMulti() {
  const files = document.getElementById("multiFileInput").files;
  if (!files.length) {
    return alert("Hãy chọn ít nhất một file CSV.");
  }

  multiYearData = {};

  try {
    for (let file of files) {
      const year = file.name.replace(/\D/g, "").slice(0, 4) || file.name;

      const text = await file.text();
      const rows = text
        .trim()
        .split("\n")
        .slice(1)
        .map((line) => {
          const [date, sku, quantity, price, promotion] = line.split(",");
          return {
            date,
            sku,
            quantity: Number(quantity),
            price,
            promotion: Number(promotion),
          };
        });

      multiYearData[year] = rows;
    }

    document.getElementById("multiRaw").textContent = JSON.stringify(
      multiYearData,
      null,
      2
    );
  } catch (err) {
    console.error(err);
    notifyError("Không đọc được file CSV đa năm.");
  }
}

// ---------------- MULTI-YEAR ANALYSIS ----------------
async function multiYearAnalysis() {
  if (!Object.keys(multiYearData).length) {
    return alert("Chưa có dữ liệu nhiều năm. Hãy upload các file CSV trước.");
  }

  try {
    showLoading();

    const res = await fetch("http://localhost:8000/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasets: multiYearData }),
    });

    if (!res.ok) {
      throw new Error(`Lỗi phân tích multi-year: ${res.status}`);
    }

    const data = await res.json();

    renderMultiAI(data);

    renderMultiChart(data.python_summary || {});
  } catch (err) {
    console.error(err);
    notifyError(err.message);
  } finally {
    hideLoading();
  }
}

function renderMultiChart(summary) {
  const ctx = document.getElementById("multiChart");

  const labels = Object.keys(summary);
  const values = Object.values(summary).map((y) => y.total_quantity || 0);

  if (multiChart) multiChart.destroy();

  multiChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tổng lượng bán theo năm",
          data: values,
          backgroundColor: "#0ea5e9",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            display: false,
          },
        },
        y: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb",
          },
        },
      },
    },
  });
}
function renderMultiAI(data) {
  const box = document.getElementById("multiAI");

  const yearly = data.ai_analysis?.yearly_analysis || {};
  const yoy = data.ai_analysis?.yoy_compare || "";
  const trend = data.ai_analysis?.long_term_trend || "";
  const key = data.ai_analysis?.key_takeaways || [];

  let html = `
    <div style="font-size:14px; line-height:1.6; color:#e5e7eb;">
      <h3 style="color:#38bdf8">📌 Tổng quan xu hướng nhiều năm</h3>
      <p>${trend}</p>

      <h3 style="color:#facc15; margin-top:14px;">🔄 So sánh tăng trưởng YoY</h3>
      <p>${yoy}</p>

      <h3 style="color:#22c55e; margin-top:14px;">📅 Phân tích từng năm</h3>
  `;

  // --- Loop các năm ---
  Object.keys(yearly).forEach((y) => {
    const obj = yearly[y];
    html += `
      <div style="
        margin-top:12px; padding:12px; border-radius:10px;
        background:rgba(15,23,42,0.85); border:1px solid rgba(148,163,184,0.25);
      ">
        <div style="color:#4ade80; font-weight:600; font-size:15px;">Năm ${y}</div>

        <ul style="margin-left:16px; margin-top:6px; font-size:13px; padding-left:0;">

          <li>• Tổng bán: <strong>${obj.total_quantity}</strong></li>
          <li>• Trung bình ngày: <strong>${obj.average_quantity}</strong></li>

          <li>• Ngày cao nhất: 
            <strong>${obj.max_day || "Không có dữ liệu"}</strong>
          </li>

          <li>• Ngày thấp nhất:
            <strong>${obj.min_day || "Không có dữ liệu"}</strong>
          </li>

          <li>• Xu hướng tháng:
            <strong>${obj.monthly_trend || "Không có dữ liệu"}</strong>
          </li>

        </ul>
      </div>
    `;
  });

  // --- KEY TAKEAWAYS ---
  html += `
      <h3 style="color:#f87171; margin-top:18px;">💡 Insight quan trọng</h3>
      <ul style="margin-left:18px;">
        ${key.map((x) => `<li style="margin:4px 0;">${x}</li>`).join("")}
      </ul>
    </div>
  `;

  box.innerHTML = html;
}
