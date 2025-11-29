# 🚀 AI Forecast System PRO - Demand Analytics

Hệ thống dự báo nhu cầu bán hàng tự động sử dụng **AI (Gemini/Mistral)** + **Time Series Forecasting (Prophet)**.

---

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cài đặt và Khởi động](#cài-đặt-và-khởi-động)
- [Hướng dẫn sử dụng](#hướng-dẫn-sử-dụng)
- [API Endpoints](#api-endpoints)
- [Cấu trúc Dữ liệu](#cấu-trúc-dữ-liệu)
- [Tính năng chính](#tính-năng-chính)
- [Xử lý sự cố](#xử-lý-sự-cố)

---

## 🎯 Tổng quan

### Mục đích

- 📊 **Dự báo bán hàng**: Sử dụng Prophet để dự báo nhu cầu 7-30 ngày
- 🧠 **Phân tích AI**: Sử dụng Gemini/Mistral để giải thích xu hướng
- 📈 **So sánh SKU**: Phân tích hiệu suất từng sản phẩm
- 📅 **Phân tích đa năm**: Theo dõi tăng trưởng YoY

### Công nghệ sử dụng

- **Backend**: FastAPI (Python)
- **Frontend**: Vanilla JavaScript + Chart.js
- **AI Model**:
  - Prophet (Time Series)
  - Google Gemini 2.0 Flash
  - Mistral AI
- **Database**: CSV (dữ liệu Walmart)
- **Chart**: Chart.js, html2canvas, jsPDF

---

## 🏗️ Kiến trúc hệ thống

```
code/
├── data/
│   ├── train.csv              # Dữ liệu gốc Walmart
│   ├── features.csv           # Các feature (Fuel_Price, MarkDown, CPI, etc.)
│   ├── stores.csv             # Thông tin cửa hàng
│   ├── convert_walmart.py     # Script chuyển đổi dữ liệu
│   └── walmart_converted.csv  # Dữ liệu đã xử lý (sử dụng cho forecast)
│
├── backend/
│   ├── main.py                # API FastAPI chính
│   └── requirements.txt        # Dependencies
│
├── client/
│   ├── index.html             # Giao diện chính
│   ├── css/
│   │   └── style.css          # Style chính
│   └── js/
│       └── main.js            # Logic frontend + gọi API
│
└── README.md                  # Tài liệu này
```

---

## ⚙️ Cài đặt và Khởi động

### 1️⃣ Yêu cầu hệ thống

- Python 3.8+
- Node.js (nếu dùng build tools, tùy chọn)
- API Keys: Gemini + Mistral

### 2️⃣ Cài đặt Backend

```bash
cd code/backend

# Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### 3️⃣ Cấu hình Environment

Tạo file `.env` trong thư mục `backend/`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
```

**Lấy API Keys:**

- 🔷 **Gemini**: https://ai.google.dev/
- 🟣 **Mistral**: https://console.mistral.ai/

### 4️⃣ Xử lý Dữ liệu Walmart (Tùy chọn)

Nếu chưa có `walmart_converted.csv`:

```bash
cd code/data
python convert_walmart.py
```

Kết quả: `walmart_converted.csv` sẽ được tạo với cấu trúc:

```
date, sku, quantity, price, promotion
2010-02-05, 1_1, 1643.00, 2.28, 0
...
```

### 5️⃣ Khởi động Backend

```bash
cd code/backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ API sẽ chạy tại: **http://localhost:8000**

Docs Swagger: **http://localhost:8000/docs**

### 6️⃣ Khởi động Frontend

**Cách 1: Mở trực tiếp (Nếu không có CORS issue)**

```bash
# Mở file index.html bằng trình duyệt
# hoặc dùng Live Server trong VSCode
```

**Cách 2: Dùng HTTP Server**

```bash
cd code/client

# Python 3
python -m http.server 3000

# Hoặc Node.js
npx http-server -p 3000
```

Truy cập: **http://localhost:3000**

---

## 📖 Hướng dẫn sử dụng

### 🔹 Tab 1: Dự báo từng SKU

**Bước 1**: Upload file CSV

- Chọn file CSV có cột: `date, sku, quantity, price, promotion`
- Bấm "📤 Upload & Xem trước"

**Bước 2**: Chọn SKU và số ngày

- Chọn SKU từ dropdown
- Nhập số ngày dự báo (7-30)

**Bước 3**: Dự báo

- Bấm "⚡ Dự báo với AI"
- Xem biểu đồ + summary từ AI
- Xuất PDF: "📄 Xuất báo cáo PDF"

---

### 🔹 Tab 2: AI Analytics

**Bước 1**: Bấm "🧠 Phân tích tự động"

**Kết quả**:

- 📝 **Kết quả phân tích**: Tổng quan, SKU mạnh/yếu, insights
- 📊 **Biểu đồ**: Tổng lượng bán theo SKU

---

### 🔹 Tab 3: So sánh SKU

**Bước 1**: Chọn 2 SKU khác nhau

**Bước 2**: Bấm "⚖ So sánh forecast"

**Kết quả**: Biểu đồ line so sánh 14 ngày dự báo

---

### 🔹 Tab 4: Multi-Year Analysis

**Bước 1**: Chọn nhiều file CSV (2022, 2023, 2024...)

**Bước 2**: Bấm "📤 Tải các file"

**Bước 3**: Bấm "🧠 AI phân tích nhiều năm"

**Kết quả**:

- 📅 Phân tích từng năm
- 🔄 So sánh YoY
- 💡 Insights dài hạn
- 📊 Biểu đồ theo năm

---

## 📡 API Endpoints

### 1. Upload CSV

```http
POST /api/upload
Content-Type: multipart/form-data

file: <file.csv>
```

**Response**:

```json
{
  "status": "success",
  "rows": 5000,
  "columns": ["date", "sku", "quantity", "price", "promotion"],
  "data_preview": [...],
  "raw_data": [...]
}
```

---

### 2. Forecast (Dự báo)

```http
POST /api/forecast
Content-Type: application/json

{
  "sku": "1_1",
  "data": [
    {"date": "2024-01-01", "quantity": 100, "price": 2.5, "promotion": 0}
  ],
  "days": 14
}
```

**Response**:

```json
{
  "forecast": [
    { "date": "2024-01-15", "forecast_qty": 125.5 },
    { "date": "2024-01-16", "forecast_qty": 128.2 }
  ],
  "summary": "Xu hướng tăng mạnh..."
}
```

---

### 3. Explain (Phân tích AI)

```http
POST /api/explain
Content-Type: application/json

{
  "data": [
    {"date": "2024-01-01", "sku": "1_1", "quantity": 100, "price": 2.5, "promotion": 0}
  ]
}
```

**Response**:

```json
{
  "mode": "single",
  "python_summary": {
    "best_sku": "1_5",
    "worst_sku": "2_1",
    "trend": "Tăng trưởng mạnh",
    "holiday_effect": 15.5,
    "key_insights": [...]
  },
  "ai_analysis": {
    "overall_summary": "...",
    "strong_skus": [...],
    "weak_skus": [...],
    "key_insights": [...]
  }
}
```

---

## 📊 Cấu trúc Dữ liệu

### Input CSV Format

```csv
date,sku,quantity,price,promotion
2010-02-05,1_1,1643.00,2.28,0
2010-02-12,1_1,1641.00,2.50,1
2010-02-19,1_2,1839.00,2.35,0
```

**Giải thích**:

- `date`: Ngày (YYYY-MM-DD)
- `sku`: Định danh sản phẩm (Store_Department)
- `quantity`: Lượng bán (đơn vị: nghìn $)
- `price`: Giá (fuel price hoặc giá tham khảo)
- `promotion`: Có khuyến mãi (0/1)

### Output Forecast

```json
{
  "date": "2024-01-15",
  "forecast_qty": 1250.5
}
```

---

## ✨ Tính năng chính

### 🎯 1. Time Series Forecasting

- Sử dụng **Prophet** (Facebook)
- Hỗ trợ seasonality (hàng tuần, hàng năm)
- Tự động phát hiện điểm gãy xu hướng
- Interval prediction: 90% confidence

### 🧠 2. AI-Powered Analysis

- **Gemini 2.0 Flash**: Phân tích chính
- **Mistral**: Fallback
- Nhận dạng SKU mạnh/yếu
- Phân tích tác động holiday/promotion
- Insights tự động

### 📈 3. Visualization

- Biểu đồ line: actual vs forecast
- Biểu đồ bar: so sánh SKU
- Biểu đồ trend: phân tích YoY
- Hỗ trợ export PDF

### 📅 4. Multi-Year Analysis

- Gộp dữ liệu từ nhiều năm
- Tính toán growth rate (YoY)
- Phân tích xu hướng dài hạn
- Key takeaways tự động

---

## 🐛 Xử lý sự cố

### ❌ Lỗi: "CORS Error"

**Nguyên nhân**: Frontend và backend ở port khác nhau

**Giải pháp**:

- Backend đã có CORS middleware
- Hoặc chạy frontend trên cùng port như backend

```bash
# Sử dụng proxy
python -m http.server 8000  # Chạy client trên 8000
```

---

### ❌ Lỗi: "API Key không hợp lệ"

**Giải pháp**:

1. Kiểm tra file `.env` trong `backend/`
2. Đảm bảo API keys đúng từ Gemini/Mistral
3. Restart FastAPI server

```bash
# Kiểm tra key
echo $GEMINI_API_KEY
```

---

### ❌ Lỗi: "Dữ liệu quá ít"

**Nguyên nhân**: Số điểm dữ liệu < 10

**Giải pháp**:

- Upload thêm dữ liệu lịch sử
- Hoặc hệ thống sẽ gộp với dữ liệu Walmart

---

### ❌ Lỗi: "Forecast thất bại"

**Giải pháp**:

1. Kiểm tra format CSV (đúng cột: date, sku, quantity...)
2. Kiểm tra ngày có hợp lệ (YYYY-MM-DD)
3. Xem logs backend để debug

```bash
# Xem logs
tail -f /path/to/backend/logs.txt
```

---

## 📚 Tài liệu tham khảo

- **Prophet Docs**: https://facebook.github.io/prophet/
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Gemini API**: https://ai.google.dev/
- **Mistral API**: https://docs.mistral.ai/

---

## 📝 Notes

- ⚠️ Dữ liệu Walmart gốc có nhiều giá trị âm → đã clip to [0, ∞)
- 💾 Forecast cache trên client (không lưu database)
- 🔐 API Keys không được hardcode → dùng `.env`
- 📊 PDF export hỗ trợ tất cả browser hiện đại

---

## 👥 Tác giả

Hệ thống được phát triển cho đồ án Công nghệ Phần mềm - Đại học Duy Tân

---

**Last Updated**: 29/11/2025
