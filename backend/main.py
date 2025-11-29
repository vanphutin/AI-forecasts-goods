from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import pandas as pd
from io import StringIO
import google.generativeai as genai
import requests
import json
import re
import numpy as np

# ======================================================
# 0. LOAD ENV + DATA NỀN TỪ /data/walmart_converted.csv
# ======================================================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

# Đường dẫn tới file data gốc (train)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "walmart_converted.csv")

base_df = None
try:
    base_df = pd.read_csv(DATA_FILE)
    base_df["date"] = pd.to_datetime(base_df["date"])
    base_df["quantity"] = base_df["quantity"].astype(float)
    print(f"✅ Loaded base data from {DATA_FILE}, rows={len(base_df)}")
except FileNotFoundError:
    print(f"⚠️ Không tìm thấy {DATA_FILE}. Forecast sẽ chỉ dùng data upload.")
except Exception as e:
    print("⚠️ Lỗi khi load base data:", e)

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# 1. UTIL: Ép chuỗi AI trả về thành JSON hợp lệ
# ============================================
def extract_json(text):
    try:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            raw_json = match.group(0)
            return json.loads(raw_json)
    except:
        pass
    return None


# ============================================
# 2. UTIL: Gọi Gemini
# ============================================
def call_gemini(prompt):
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print("Gemini lỗi:", e)
        return None


# ============================================
# 3. UTIL: Gọi Mistral
# ============================================
def call_mistral(prompt):
    try:
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {MISTRAL_API_KEY}"}
        payload = {
            "model": "mistral-small-latest",
            "messages": [{"role": "user", "content": prompt}]
        }
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print("Mistral lỗi:", e)
        return None


# ============================================
# 4. API UPLOAD CSV
# ============================================
@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read()

    df = pd.read_csv(StringIO(content.decode("utf-8")))
    preview = df.head().to_dict(orient="records")

    return {
        "status": "success",
        "rows": df.shape[0],
        "columns": df.columns.tolist(),
        "data_preview": preview,
        "raw_data": df.to_dict(orient="records")
    }


# ============================================
# 5. API DỰ BÁO — HYBRID:
#    Base data (/data/walmart_converted.csv)
#    + User upload  → Prophet + AI summary
# ============================================
@app.post("/api/forecast")
async def forecast(payload: dict):
    from prophet import Prophet

    sku = payload["sku"]
    history = payload["data"]
    days = payload.get("days", 14)

    # -------- 1) Data user upload --------
    user_df = pd.DataFrame(history)
    if "date" not in user_df.columns or "quantity" not in user_df.columns:
        raise HTTPException(400, "Thiếu cột 'date' hoặc 'quantity' trong payload")

    user_df["date"] = pd.to_datetime(user_df["date"])
    user_df["quantity"] = user_df["quantity"].astype(float)

    # -------- 2) Data nền từ walmart_converted.csv --------
    global base_df
    if base_df is not None:
        base_sku_df = base_df[base_df["sku"] == sku][["date", "quantity"]]
    else:
        base_sku_df = pd.DataFrame(columns=["date", "quantity"])

    # -------- 3) Gộp 2 nguồn dữ liệu lại --------
    combined = pd.concat(
        [base_sku_df, user_df[["date", "quantity"]]],
        ignore_index=True
    )

    # loại null, trùng ngày, sort
    combined = (
        combined
        .dropna(subset=["date", "quantity"])
        .drop_duplicates(subset=["date"])
        .sort_values("date")
    )

    if len(combined) < 10:
        raise HTTPException(
            400,
            f"Dữ liệu sau khi gộp cho SKU {sku} quá ít (len={len(combined)}). Cần >= 10 điểm dữ liệu."
        )

    # -------- 4) Train Prophet --------
    df_model = combined.rename(columns={"date": "ds", "quantity": "y"})
    df_model["ds"] = pd.to_datetime(df_model["ds"])
    df_model["y"] = df_model["y"].astype(float)

    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.5,
        interval_width=0.9,
    )
    model.fit(df_model)

    future = model.make_future_dataframe(periods=days)
    forecast_df = model.predict(future)

    fc = forecast_df.tail(days)[["ds", "yhat"]]

    forecast_list = [
        {
            "date": row.ds.strftime("%Y-%m-%d"),
            "forecast_qty": float(round(row.yhat, 2))
        }
        for row in fc.itertuples()
    ]

    avg_fc = float(round(fc.yhat.mean(), 2))

    # -------- 5) AI SUMMARY (Gemini/Mistral) --------
    prompt = f"""
    Bạn là chuyên gia dữ liệu.

    Mô hình Prophet đã được train trên:
    - Dữ liệu nền từ Walmart (walmart_converted.csv) cho SKU: {sku}
    - Kết hợp thêm dữ liệu người dùng upload (nếu có)

    Số điểm dữ liệu sau khi gộp: {len(combined)}
    Số ngày dự báo: {days}
    Giá trị dự báo trung bình: {avg_fc}

    Dữ liệu dự báo:
    {json.dumps(forecast_list, ensure_ascii=False, indent=2)}

    Hãy viết một đoạn phân tích xu hướng CHUYÊN SÂU nhưng ngắn gọn, bao gồm:
    - Xu hướng tổng thể (tăng/giảm/ổn định)
    - Nhận xét về độ biến động theo ngày
    - Rủi ro, bất định (nếu có)
    - Gợi ý cho bộ phận mua hàng/kho vận

    Trả về JSON:
    {{
        "summary": ""
    }}
    """

    ai_raw = call_gemini(prompt) or call_mistral(prompt)
    ai_json = extract_json(ai_raw) if ai_raw else None
    final_summary = ai_json.get("summary", "") if ai_json else "Không tạo được summary từ AI."

    return {
        "forecast": forecast_list,
        "summary": final_summary
    }


# ============================================
# 6. API GIẢI THÍCH DỮ LIỆU (như bạn đang dùng)
# ============================================
@app.post("/api/explain")
async def explain(payload: dict):

    # ---------- CASE 1 — MULTI YEAR ----------
    if "datasets" in payload:
        datasets = payload["datasets"]
        summary = {}

        for year, rows in datasets.items():
            df = pd.DataFrame(rows)

            total_qty = df["quantity"].sum()
            avg_qty = df["quantity"].mean()

            max_day = df.loc[df["quantity"].idxmax()]
            min_day = df.loc[df["quantity"].idxmin()]

            promo_days = df[df["promotion"] == 1]
            promo_effect = (
                promo_days["quantity"].mean() if len(promo_days) else None
            )

            monthly = df.groupby(df["date"].str[:7])["quantity"].sum().to_dict()

            summary[year] = {
                "total_quantity": int(total_qty),
                "average_quantity": round(avg_qty, 2),
                "max_day": {
                    "date": max_day["date"],
                    "quantity": int(max_day["quantity"])
                },
                "min_day": {
                    "date": min_day["date"],
                    "quantity": int(min_day["quantity"])
                },
                "monthly_total": monthly,
                "promotion_effect": promo_effect
            }

        yoy = {}
        years = sorted(summary.keys())
        for i in range(1, len(years)):
            prev = years[i - 1]
            curr = years[i]
            growth = round(((summary[curr]["total_quantity"] -
                             summary[prev]["total_quantity"]) /
                             summary[prev]["total_quantity"]) * 100, 2)
            yoy[f"{prev}->{curr}"] = growth

        prompt = f"""
        Bạn là chuyên gia phân tích số liệu bán hàng.

        Đây là dữ liệu đã được tổng hợp:
        {json.dumps(summary, ensure_ascii=False)}

        Tăng trưởng YoY:
        {json.dumps(yoy, ensure_ascii=False)}

        Hãy phân tích:
        - Xu hướng từng năm
        - So sánh YoY
        - Xu hướng dài hạn
        - 3–6 insight sâu sắc nhất

        Trả JSON:
        {{
            "yearly_analysis": {{}},
            "yoy_compare": "",
            "long_term_trend": "",
            "key_takeaways": []
        }}
        """

        ai_raw = call_gemini(prompt) or call_mistral(prompt)
        parsed = extract_json(ai_raw)

        return {
            "mode": "multi-year",
            "python_summary": summary,
            "yoy": yoy,
            "ai_analysis": parsed
        }

    # ---------- CASE 2 — SINGLE FILE ----------
    elif "data" in payload:
        df = pd.DataFrame(payload["data"])
        df["date"] = pd.to_datetime(df["date"])

        by_sku = df.groupby("sku")["quantity"].sum().sort_values(ascending=False)
        best = by_sku.index[0]
        worst = by_sku.index[-1]

        daily = df.groupby("date")["quantity"].sum()
        slope = np.polyfit(np.arange(len(daily)), daily.values, 1)[0]

        trend = (
            "Tăng trưởng mạnh" if slope > 0 else
            "Giảm dài hạn" if slope < 0 else
            "Ổn định"
        )

        holiday_sales = df[df["promotion"] == 1]["quantity"].mean()
        normal_sales = df[df["promotion"] == 0]["quantity"].mean()
        promo_effect = float(round(holiday_sales - normal_sales, 2))

        df_sorted = df.sort_values("date")
        first30 = df_sorted.head(30).groupby("sku")["quantity"].sum()
        last30 = df_sorted.tail(30).groupby("sku")["quantity"].sum()
        growth = (last30 - first30).fillna(0).sort_values(ascending=False)

        top_growth = growth.head(5).to_dict()
        top_decline = growth.tail(5).to_dict()

        monthly = df.groupby(df["date"].dt.strftime("%Y-%m"))["quantity"].sum().to_dict()

        python_summary = {
            "best_sku": best,
            "worst_sku": worst,
            "trend": trend,
            "holiday_effect": promo_effect,
            "top_growth": top_growth,
            "top_decline": top_decline,
            "monthly": monthly,
            "sku_totals": by_sku.to_dict()
        }

        prompt = f"""
        Bạn là chuyên gia phân tích dữ liệu bán hàng.

        Dữ liệu đã xử lý:
        {json.dumps(python_summary, ensure_ascii=False, indent=2)}

        Hãy viết phân tích sâu gồm:
        - Tổng quan tổng thể
        - SKU mạnh nhất + giải thích
        - SKU yếu nhất + giải thích
        - Tác động của holiday/promotion
        - Xu hướng dài hạn của thị trường
        - Top SKU tăng trưởng + nguyên nhân
        - Top SKU giảm mạnh + nguyên nhân
        - 4–8 key insights dạng bullet

        Trả về JSON:
        {{
            "overall_summary": "",
            "strong_skus": [],
            "weak_skus": [],
            "key_insights": []
        }}
        """

        ai_raw = call_gemini(prompt) or call_mistral(prompt)
        parsed = extract_json(ai_raw)

        return {
            "mode": "single",
            "python_summary": python_summary,
            "ai_analysis": parsed or {"error": "JSON sai định dạng"}
        }

    else:
        raise HTTPException(400, "Payload không hợp lệ")
