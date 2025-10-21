
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any

DATA_PATH = "labs.csv"

app = FastAPI(title="LabRisk AI Backend (CSV-enabled)", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

df = pd.read_csv(DATA_PATH)

class LabInput(BaseModel):
    HGB: float = Field(..., description="Hemoglobin g/L")
    MCV: float = Field(..., description="Mean corpuscular volume fL")
    GLU: float = Field(..., description="Glucose mmol/L")
    ALT: float = Field(..., description="ALT U/L")
    AST: float = Field(..., description="AST U/L")
    CREA: float = Field(..., description="Creatinine µmol/L")
    TSH: float = Field(..., description="TSH mIU/L")

REFS = {
  "HGB": {"low": 120, "high": 170},
  "MCV": {"low": 80, "high": 100},
  "GLU": {"low": 3.9, "high": 6.0},
  "ALT": {"low": 0, "high": 45},
  "AST": {"low": 0, "high": 45},
  "CREA": {"low": 62, "high": 106},
  "TSH": {"low": 0.4, "high": 4.0},
}

def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))

def compute_risks(v: Dict[str, float]) -> Dict[str, int]:
    dGLU = max(0.0, (v["GLU"] - REFS["GLU"]["high"]) / 3.0)
    dHBA = max(0.0, (REFS["HGB"]["low"] - v["HGB"]) / 30.0)
    dMCVlow = max(0.0, (REFS["MCV"]["low"] - v["MCV"]) / 10.0)
    dLiver = max(v["ALT"] - REFS["ALT"]["high"], 0.0)/30.0 + max(v["AST"] - REFS["AST"]["high"],0.0)/30.0
    dKidney = max(v["CREA"] - REFS["CREA"]["high"], 0.0) / 50.0
    dThy = max(v["TSH"] - REFS["TSH"]["high"], 0.0) / 3.0 + max(REFS["TSH"]["low"] - v["TSH"], 0.0)/0.4

    diabetes = clamp01(0.65*dGLU + 0.15*dLiver + 0.1*dKidney + 0.1*dThy)
    anemia = clamp01(0.7*dHBA + 0.3*dMCVlow)
    liver = clamp01(dLiver)
    kidney = clamp01(dKidney*0.9 + 0.1*dLiver)
    thyroid = clamp01(dThy)

    return {
        "Diabetes": round(diabetes*100),
        "Anemia": round(anemia*100),
        "Liver": round(liver*100),
        "Kidney": round(kidney*100),
        "Thyroid": round(thyroid*100),
    }

def recommendations(scores: Dict[str,int], v: Dict[str, float]) -> List[str]:
    recs = []
    if scores["Diabetes"] >= 40 or v["GLU"] > REFS["GLU"]["high"]:
        recs.append("Повышенная глюкоза — повторить натощак, рассмотреть HbA1c/ОГТТ, рекомендации по образу жизни.")
    if scores["Anemia"] >= 40 or v["HGB"] < REFS["HGB"]["low"]:
        recs.append("Признаки анемии — проверить ферритин/Fe/В12, оценить MCV для типирования.")
    if scores["Liver"] >= 40 or v["ALT"] > REFS["ALT"]["high"] or v["AST"] > REFS["AST"]["high"]:
        recs.append("Печёночные ферменты — исключить медикаменты/алкоголь, вирусные гепатиты, УЗИ печени.")
    if scores["Kidney"] >= 40 or v["CREA"] > REFS["CREA"]["high"]:
        recs.append("Креатинин повышен — оценить eGFR, гидратацию, пересмотреть нефротоксичные препараты.")
    if scores["Thyroid"] >= 40 or (v["TSH"] > REFS["TSH"]["high"] or v["TSH"] < REFS["TSH"]["low"]):
        recs.append("TSH вне диапазона — повторить, проверить FT4/FT3, консультация эндокринолога по показаниям.")
    if not recs:
        recs.append("Существенных красных флагов не выявлено. Демонстрационный результат, не медицинский диагноз.")
    return recs

@app.get("/health")
def health():
    return {"status":"ok", "records": int(df.shape[0])}

@app.get("/patients")
def patients_list() -> List[int]:
    return df["PatientID"].astype(int).tolist()

@app.get("/patient/{pid}")
def get_patient(pid: int) -> Dict[str, Any]:
    row = df[df["PatientID"] == pid]
    if row.empty:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    return row.iloc[0].to_dict()

@app.post("/predict")
def predict(payload: LabInput) -> Dict[str, Any]:
    v = payload.model_dump()
    scores = compute_risks(v)
    top = []
    for k, ref in REFS.items():
        mid = (ref["low"] + ref["high"])/2.0
        span = max(1e-9, (ref["high"] - ref["low"])/2.0)
        w = abs(v[k] - mid)/span
        top.append((k, w))
    top = sorted(top, key=lambda x: x[1], reverse=True)[:3]
    factors = [{"key": k, "weight": round(w*100)} for k, w in top]
    return {"scores": scores, "recommendations": recommendations(scores, v), "topFactors": factors, "refs": REFS}
