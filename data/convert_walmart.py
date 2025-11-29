import pandas as pd

print("🔵 Loading Walmart CSV files...")

train = pd.read_csv("train.csv")
features = pd.read_csv("features.csv")
stores = pd.read_csv("stores.csv")

print("✅ Loaded all CSV files successfully!")

# -----------------------------------------------------
# MERGE DATA
# -----------------------------------------------------
print("🔵 Merging datasets...")

df = train.merge(features, on=["Store", "Date", "IsHoliday"], how="left")
df = df.merge(stores, on="Store", how="left")

print(f"➡ Total rows after merge: {len(df)}")

# -----------------------------------------------------
# CREATE SKU = Store_Dept
# -----------------------------------------------------
df["sku"] = df["Store"].astype(str) + "_" + df["Dept"].astype(str)

# -----------------------------------------------------
# CONVERT TO SYSTEM FORMAT
# -----------------------------------------------------
print("🔵 Converting to system format...")

df_final = pd.DataFrame({
    "date": df["Date"],
    "sku": df["sku"],
    "quantity": df["Weekly_Sales"],
    "price": df["Fuel_Price"].fillna(0),
    "promotion": df["IsHoliday"].astype(int)
})

# Clean negative sales (Walmart có nhiều giá trị âm)
df_final["quantity"] = df_final["quantity"].clip(lower=0)

# -----------------------------------------------------
# SAVE FILE
# -----------------------------------------------------
output_path = "walmart_converted.csv"
df_final.to_csv(output_path, index=False)

print("🎉 DONE! File converted successfully!")
print(f"📁 Saved to: {output_path}")
print(f"📊 Total rows: {len(df_final)}")
print(f"🛒 Total SKU: {df_final['sku'].nunique()}")
