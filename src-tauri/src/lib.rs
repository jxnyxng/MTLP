use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

const KEYRING_SERVICE: &str = "com.mtlp.desktop";
const KEYRING_ACCOUNT: &str = "gemini-api-key";
const GEMINI_ENDPOINT: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

fn gemini_key_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_gemini_api_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("EMPTY_API_KEY".into());
    }
    gemini_key_entry()?
        .set_password(api_key)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn has_gemini_api_key() -> Result<bool, String> {
    match gemini_key_entry()?.get_password() {
        Ok(value) => Ok(!value.trim().is_empty()),
        Err(KeyringError::NoEntry) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiReview {
    summary: String,
    feedback: String,
    next_action: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewResponse {
    summary: String,
    feedback: String,
    next_action: String,
}

#[tauri::command]
async fn generate_gemini_review(prompt: String) -> Result<ReviewResponse, String> {
    if prompt.chars().count() > 12_000 {
        return Err("PROMPT_TOO_LARGE".into());
    }
    let api_key = gemini_key_entry()?
        .get_password()
        .map_err(|error| match error {
            KeyringError::NoEntry => "MISSING_API_KEY".into(),
            other => other.to_string(),
        })?;
    let client = tauri_plugin_http::reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(GEMINI_ENDPOINT)
        .header("x-goog-api-key", api_key)
        .json(&json!({
            "contents": [{ "parts": [{ "text": prompt }] }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "maxOutputTokens": 700,
                "temperature": 0.4
            }
        }))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "GEMINI_TIMEOUT".to_string()
            } else {
                "GEMINI_NETWORK".to_string()
            }
        })?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("GEMINI_HTTP_{}", status.as_u16()));
    }
    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "GEMINI_INVALID_RESPONSE")?;
    let text = payload
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|value| value.as_str())
        .ok_or("GEMINI_EMPTY_RESPONSE")?;
    let review: GeminiReview = serde_json::from_str(text).map_err(|_| "GEMINI_INVALID_RESPONSE")?;
    Ok(ReviewResponse {
        summary: review.summary,
        feedback: review.feedback,
        next_action: review.next_action,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            save_gemini_api_key,
            has_gemini_api_key,
            generate_gemini_review
        ])
        .run(tauri::generate_context!())
        .expect("error while running MTLP");
}
