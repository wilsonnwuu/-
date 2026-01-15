
import { GoogleGenAI } from "@google/genai";
import { SoilParams, WallDimensions, CalculationResult } from "../types";

const initGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeWallDesign = async (
  soil: SoilParams,
  dims: WallDimensions,
  calcs: CalculationResult
) => {
  try {
    const ai = initGenAI();
    
    // Find derived structural params in details
    const nVal = calcs.details.find(d => d.item === 'Modulus Ratio (n)')?.value || '-';
    const fcVal = calcs.details.find(d => d.item === 'Allowable Conc. (fc)')?.value || '-';
    const fsVal = calcs.details.find(d => d.item === 'Allowable Steel (fs)')?.value || '-';

    const prompt = `
      作為一位資深大地工程師 (Senior Geotechnical Engineer)，請根據以下參數為我設計最適合的擋土牆。

      **1. 背填土參數 (Backfill Soil Parameters):**
      - 牆高 (H): ${soil.height} m
      - 乾土單位重 (Gamma Dry): ${soil.gammaDry} kN/m³
      - 飽和單位重 (Gamma Sat): ${soil.gammaSat} kN/m³
      - 摩擦角 (Phi): ${soil.phi}°
      - 凝聚力 (Cohesion): ${soil.cohesion} kPa
      - 回填土坡度 (Slope): ${soil.slopeAngle}°
      - 地下水位深 (Water Depth): ${soil.waterDepth} m (from top)
      - 額外載重 (Surcharge): ${soil.surcharge} kN/m²

      **2. 基礎土壤參數 (Foundation Soil Parameters):**
      - 摩擦角 (Phi_fdn): ${soil.foundationPhi}°
      - 凝聚力 (Cohesion_fdn): ${soil.foundationCohesion} kPa
      - 單位重 (Gamma_fdn): ${soil.foundationGamma} kN/m³
      - 被動土高度 (Passive Height): ${soil.foundationSoilHeight} m
      - 容許承載力 (Allowable Bearing): ${soil.allowableBearing} kPa

      **3. 結構材料參數 (Structural Materials):**
      - 混凝土單位重 (Gamma_c): ${soil.concreteGamma} kN/m³
      - 混凝土抗壓強度 (f'c): ${soil.fPrimeC} MPa
      - 容許撓曲壓應力 (fc): ${fcVal} MPa
      - 鋼筋降伏強度 (fy): ${soil.fy} MPa
      - 容許拉應力 (fs): ${fsVal} MPa
      - 彈性模數比 (n): ${nVal}
      - 保護層厚度 (Cover): ${soil.concreteCover} cm

      **4. 目前設計尺寸 (Current Dimensions):**
      - 底版寬度 (B): ${dims.B} m
      - 趾部寬度 (Toe): ${dims.toe} m
      - 牆身底厚 (Stem Base): ${dims.stemBottom} m
      - 牆身頂厚 (Stem Top): ${dims.stemTop} m
      - 牆身斜面方向 (Stem Batter): ${dims.stemBatterSide === 'heel' ? '背填土側 (Back/Heel)' : '前方 (Front/Toe)'}
      - 止滑榫深度 (Shear Key): ${dims.keyDepth > 0 ? `${dims.keyDepth} m` : '無 (None)'}

      **5. 穩定性試算結果 (Stability Results):**
      - 牆背傾斜角 (Beta): ${calcs.beta.toFixed(1)}°
      - 牆背摩擦角 (Delta): ${calcs.delta.toFixed(1)}°
      - 抗翻倒 FS (Overturning): ${calcs.fsOverturning.toFixed(2)} (目標 >= 2.0)
      - 抗滑動 FS (Sliding): ${calcs.fsSliding.toFixed(2)} (目標 >= 1.5)
      - 偏心距 (Eccentricity e): ${calcs.eccentricity.toFixed(2)} m (目標 e <= B/6 = ${(dims.B/6).toFixed(2)})
      - 基底壓力 (Bearing): Max=${calcs.qMax.toFixed(1)} kPa / Min=${calcs.qMin.toFixed(1)} kPa
      - 承載力安全? ${calcs.isBearingSafe ? '是 (Safe)' : '否 (Unsafe)'} (q_max <= ${soil.allowableBearing})
      - 主動土壓力係數 (Ka): ${calcs.ka.toFixed(3)}
      - 被動土壓力係數 (Kp): ${calcs.kp.toFixed(3)} (Coulomb)
      - 水壓力總力 (Water Force): ${calcs.waterForce.toFixed(1)} kN/m

      **設計任務 (Design Task):**
      請遵循以下邏輯並以 **繁體中文 (Traditional Chinese)** 輸出專業報告：

      1.  **穩定性綜合評估**: 
          - 針對 滑動(Sliding)、翻倒(Overturning)、承載力(Bearing) 與 偏心(Eccentricity) 四大指標進行評論。
          - 特別指出哪一項最危險或已不合格。

      2.  **幾何優化建議**: 
          - 如果承載力不足，建議如何調整底版寬度 (B) 或趾部長度 (Toe)。
          - 如果偏心距過大，如何調整牆身幾何來改善重心位置。

      3.  **結構配筋概念**:
          - 根據 $f'_c$ 與 $f_y$ 參數，簡要說明此牆高的牆底 (Stem Base) 大致需要的配筋量級（輕、中、重度配筋）或裂縫控制注意事項。
          - 針對 $7.5$ cm 的保護層是否足夠提供建議。

      4.  **綜合結論**: 給出最終設計優化方向。

      請使用 Markdown 格式，重點數據請加粗。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `You are an expert Civil Engineer. 
        You follow standard design codes. 
        You prioritize safety (FS > 1.5 Sliding, FS > 2.0 Overturning, e < B/6, q < q_all).
        You always respond in Traditional Chinese (繁體中文).`,
        temperature: 0.4, 
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
