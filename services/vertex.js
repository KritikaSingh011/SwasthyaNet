const CLOUD_API_KEY = "AIzaSyCvS-gaGVSQMx3avRLbuLiZXjroFH9uVPA"; // Provided by user
const REGION = "us-central1";
const PROJECT_ID = "swasthyanet-demo";
const ENDPOINT_ID = "forecast-model-endpoint"; // Deployed Vertex AI forecasting model

/**
 * Invokes the Vertex AI Forecasting Endpoint to retrieve stock depletion curves
 */
export async function getVertexForecast(facilityId, medicineId, currentStock, avgDailyUse) {
  // Production URL for Vertex AI Prediction endpoint:
  const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/${ENDPOINT_ID}:predict`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUD_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instances: [
          {
            facility_id: String(facilityId),
            medicine_id: String(medicineId),
            current_stock: Number(currentStock),
            avg_daily_use: Number(avgDailyUse),
            timestamp: new Date().toISOString()
          }
        ]
      })
    });

    const result = await response.json();
    // Parse predicted depletion days from Vertex AI response
    // E.g., result.predictions = [{ days_remaining: 12 }]
    return result.predictions?.[0]?.days_remaining ?? Math.round(currentStock / avgDailyUse);
  } catch (error) {
    // If the endpoint is not deployed yet, calculate standard depletion days locally as a fallback
    console.warn("Vertex AI Endpoint prediction not active. Falling back to local demand calculation.");
    return avgDailyUse > 0 ? currentStock / avgDailyUse : 999;
  }
}
